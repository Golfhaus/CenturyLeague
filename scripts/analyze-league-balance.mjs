import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { importDraftedTeams, simulateMatch, matchBriefing, MATCH_ENGINE_VERSION } from '../packages/simulation-core/dist/match/index.js';

const hash = s => createHash('sha256').update(s).digest('hex');
const mean = xs => xs.reduce((s,x)=>s+x,0)/xs.length;
const atomic = (file,data) => { fs.writeFileSync(`${file}.tmp`,JSON.stringify(data)); fs.renameSync(`${file}.tmp`,file); };
const checkpointName = (a,b) => `pair-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}.json`;
function wilson(w,n) {
  const z=1.959963984540054,p=w/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
  return [Math.max(0,c-h),Math.min(1,c+h)];
}
function validate(r) {
  if(r.status!=='complete'||r.scores[r.winner]!==100||r.scores[1-r.winner]>=100||r.quarters.length!==4) throw Error('Illegal result');
  for(const side of [0,1]) {
    const players=r.players.filter(p=>p.side===side);
    if(players.reduce((s,p)=>s+(p.stats.points??0),0)!==r.scores[side]||r.teamStats[side].points!==r.scores[side]||
      r.quarters.reduce((s,q)=>s+q.points[side],0)!==r.scores[side]) throw Error('Score reconciliation failed');
    for(const key of new Set(players.flatMap(p=>Object.keys(p.stats))))
      if(players.reduce((s,p)=>s+(p.stats[key]??0),0)!==(r.teamStats[side][key]??0)) throw Error(`Stat reconciliation failed: ${key}`);
    if(Math.abs(players.reduce((s,p)=>s+p.secondsPlayed,0)-r.teamStats[side].playerSeconds)>1e-6) throw Error('Playing-time reconciliation failed');
  }
  const lastScore=r.events.filter(e=>e.type==='score').at(-1);
  if(!lastScore||lastScore.side!==r.winner) throw Error('Missing winning event');
}

if(!isMainThread) {
  const {teams,tasks,repeats,output,manifest}=workerData;
  const snapshot=JSON.stringify(teams);
  for(const [a,b] of tasks) {
    const file=path.join(output,checkpointName(a,b));
    if(fs.existsSync(file)) {
      const cached=JSON.parse(fs.readFileSync(file));
      if(cached.length!==repeats||cached.some((g,n)=>g.a!==a||g.b!==b||g.seed!==`century-full-league-v0.1:${a}:${b}:${n}`)) throw Error('Invalid checkpoint');
      parentPort.postMessage({a,b,cached:true});continue;
    }
    const games=[];
    for(let n=0;n<repeats;n++) {
      const sides=n%2?[b,a]:[a,b];
      const input={id:`league-${a}-${b}-${String(n+1).padStart(3,'0')}`,seed:`century-full-league-v0.1:${a}:${b}:${n}`,
        teams:sides.map(i=>teams[i]),provenance:{engineSourceCommit:manifest.engineSourceCommit,
          engineSourceSHA256:manifest.engineSourceSHA256,inputSHA256:manifest.inputSHA256}};
      const r=simulateMatch(input);validate(r);
      const side=sides.indexOf(a),brief=matchBriefing(r);
      games.push({id:input.id,seed:input.seed,a,b,sides,winner:sides[r.winner],
        scores:[r.scores[side],r.scores[1-side]],signedMargin:r.scores[side]-r.scores[1-side],
        playingMinutes:r.playingSeconds/60,elapsedMinutes:r.elapsedSeconds/60,leadChanges:brief.leadChanges,
        teamStats:[r.teamStats[side],r.teamStats[1-side]],
        players:r.players.map(p=>({...p,teamIndex:sides[p.side]})),
        quarters:r.quarters.map(q=>({...q,points:[q.points[side],q.points[1-side]],cumulative:[q.cumulative[side],q.cumulative[1-side]]})),
        winningPlay:brief.winningPlay});
      if(n===0) atomic(path.join(output,'samples',`${input.id}.json`),r);
    }
    if(JSON.stringify(teams)!==snapshot) throw Error('Simulator changed an input');
    atomic(file,games);parentPort.postMessage({a,b,cached:false});
  }
} else {
  const args=process.argv.slice(2),option=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];};
  const files=['--players','--draft','--coaches'].map(k=>option(k));
  if(files.some(f=>!f)) throw Error('Supply --players, --draft and --coaches canonical files');
  const repeats=Number(option('--repeats','50')),workers=Number(option('--workers',String(Math.min(6,os.availableParallelism()))));
  if(!Number.isInteger(repeats)||repeats<2||repeats>2000||repeats%2) throw Error('Use an even repeats count from 2 to 2000');
  if(!Number.isInteger(workers)||workers<1||workers>32) throw Error('Use 1–32 workers');
  const output=path.resolve(option('--output','league-balance-study')),raw=files.map(f=>fs.readFileSync(f,'utf8'));
  const draft=JSON.parse(raw[1]);
  if(!draft.draft_complete||draft.rounds_completed!==35) throw Error('Draft must be complete');
  const teams=importDraftedTeams(JSON.parse(raw[0]),draft.picks,JSON.parse(raw[2]).coaches);
  const sourceFiles=['engine.ts','input.ts','scoring.ts','statistics.ts','types.ts','report.ts'].map(f=>path.join('packages/simulation-core/src/match',f))
    .concat(['random.ts','roleRatings.ts','config.ts','types.ts'].map(f=>path.join('packages/simulation-core/src',f)));
  const sourceHash=hash(sourceFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n'));
  const pairs=teams.flatMap((_,a)=>teams.slice(a+1).map((_,j)=>[a,a+1+j]));
  const manifest={engineVersion:MATCH_ENGINE_VERSION,engineSourceCommit:'ebd0a56161e2536fdaa167f376f05b3b303dc9bd',engineSourceSHA256:sourceHash,
    condition:'original',teams:teams.map(t=>t.name),repeatsPerPair:repeats,pairings:pairs.length,expectedMatches:pairs.length*repeats,
    sidesPerPair:[repeats/2,repeats/2],sourceSHA256:raw.map(hash),inputSHA256:hash(JSON.stringify(teams)),
    seedScheme:'century-full-league-v0.1:{a}:{b}:{repeatIndex}',carryover:'none',
    stoppingRule:'All pairings completed, no outcome-based early stopping or seed rerolls; no engine or roster changes.'};
  fs.mkdirSync(path.join(output,'samples'),{recursive:true});
  const mf=path.join(output,'manifest.json');
  if(fs.existsSync(mf)&&JSON.stringify(JSON.parse(fs.readFileSync(mf)))!==JSON.stringify(manifest)) throw Error('Output manifest differs');
  atomic(mf,manifest);atomic(path.join(output,'teams.json'),teams);
  let completed=0;
  await Promise.all(Array.from({length:Math.min(workers,pairs.length)},(_,i)=>new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{teams,repeats,output,manifest,tasks:pairs.filter((_,j)=>j%workers===i)}});
    worker.on('message',()=>{completed++;console.log(`Pairings ${completed}/${pairs.length}; matches ${completed*repeats}/${manifest.expectedMatches}`);});
    worker.on('error',reject);worker.on('exit',code=>code?reject(Error(`Worker exit ${code}`)):resolve());
  })));
  const games=[],series=[];
  const out=fs.createWriteStream(path.join(output,'matches.ndjson'));
  for(const [a,b] of pairs) {
    const rows=JSON.parse(fs.readFileSync(path.join(output,checkpointName(a,b))));
    for(const g of rows) {if(!out.write(JSON.stringify(g)+'\n')) await new Promise(resolve=>out.once('drain',resolve));games.push({...g,players:undefined});}
    const wins=rows.filter(g=>g.winner===a).length;
    series.push({a,b,aName:teams[a].name,bName:teams[b].name,aWins:wins,bWins:repeats-wins,wilson95A:wilson(wins,repeats),
      meanSignedMargin:mean(rows.map(g=>g.signedMargin)),marginSD:Math.sqrt(mean(rows.map(g=>g.signedMargin**2))-mean(rows.map(g=>g.signedMargin))**2),
      meanScores:[mean(rows.map(g=>g.scores[0])),mean(rows.map(g=>g.scores[1]))],
      closestMargin:Math.min(...rows.map(g=>Math.abs(g.signedMargin))),widestMargin:Math.max(...rows.map(g=>Math.abs(g.signedMargin))),
      closeFinishesWithin10:rows.filter(g=>Math.abs(g.signedMargin)<=10).length});
  }
  await new Promise(resolve=>out.end(resolve));
  if(games.length!==manifest.expectedMatches||new Set(games.map(g=>g.seed)).size!==games.length) throw Error('Study incomplete');
  const clubs=teams.map((team,index)=>{
    const own=games.filter(g=>g.a===index||g.b===index),wins=own.filter(g=>g.winner===index).length;
    const stats=side=>own.reduce((s,g)=>{const k=g.a===index?0:1;for(const [key,value] of Object.entries(g.teamStats[side?k^1:k]))s[key]=(s[key]??0)+value;return s;},{});
    const forStats=stats(0),againstStats=stats(1),ownSeries=series.filter(s=>s.a===index||s.b===index);
    const seriesWins=s=>s.a===index?s.aWins:s.bWins;
    return {index,name:team.name,coach:team.coach.name,matches:own.length,wins,losses:own.length-wins,winRate:wins/own.length,
      wilson95:wilson(wins,own.length),meanFor:mean(own.map(g=>g.scores[g.a===index?0:1])),
      meanAgainst:mean(own.map(g=>g.scores[g.a===index?1:0])),
      favorableSeries:ownSeries.filter(s=>seriesWins(s)>repeats/2).length,evenSeries:ownSeries.filter(s=>seriesWins(s)===repeats/2).length,
      unfavorableSeries:ownSeries.filter(s=>seriesWins(s)<repeats/2).length,
      opponentsBeaten:ownSeries.filter(s=>seriesWins(s)>0).length,sweptOpponents:ownSeries.filter(s=>seriesWins(s)===repeats).length,
      forStats,againstStats,shotShare:forStats.shots/(forStats.shots+againstStats.shots),
      ballUpShare:forStats.ballUpsWon/(forStats.ballUpsWon+againstStats.ballUpsWon),
      groundRecoveryShare:forStats.recoveries/(forStats.recoveries+againstStats.recoveries),
      pointsPerShot:forStats.points/forStats.shots,opponentPointsPerShot:againstStats.points/againstStats.shots};
  }).sort((a,b)=>b.wins-a.wins);
  const result={manifest,matches:games.length,clubs,series,
    descriptiveBands:{below25:clubs.filter(c=>c.winRate<.25).length,from25To75:clubs.filter(c=>c.winRate>=.25&&c.winRate<=.75).length,above75:clubs.filter(c=>c.winRate>.75).length},
    sweptSeries:series.filter(s=>Math.min(s.aWins,s.bWins)===0).length,
    minorityAtLeast10Wins:series.filter(s=>Math.min(s.aWins,s.bWins)>=10).length,
    minorityAtLeast15Wins:series.filter(s=>Math.min(s.aWins,s.bWins)>=15).length,
    evenSeries:series.filter(s=>s.aWins===s.bWins).length,
    closeFinishesWithin10:games.filter(g=>Math.abs(g.signedMargin)<=10).length,
    meanPlayingMinutes:mean(games.map(g=>g.playingMinutes)),side0Wins:games.filter(g=>g.winner===g.sides[0]).length};
  atomic(path.join(output,'summary.json'),result);
  console.log(JSON.stringify({...result,manifest:undefined,clubs:clubs.map(c=>({name:c.name,wins:c.wins,losses:c.losses})),series:undefined},null,2));
}
