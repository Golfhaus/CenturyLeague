import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { simulateMatch, matchBriefing, TACTIC_KEYS, MATCH_ENGINE_VERSION } from '../packages/simulation-core/dist/match/index.js';
import { ROLE_WEIGHTS } from '../packages/simulation-core/dist/config.js';
import { calculateRoleRatings } from '../packages/simulation-core/dist/roleRatings.js';

const hash=s=>createHash('sha256').update(s).digest('hex');
const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const atomic=(file,data)=>{fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file);};
function wilson(w,n) {
  const z=1.959963984540054,p=w/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
  return [Math.max(0,c-h),Math.min(1,c+h)];
}
function solve(matrix,rhs) {
  const a=matrix.map((row,i)=>[...row,rhs[i]]),n=a.length;
  for(let i=0;i<n;i++) {
    const pivot=Array.from({length:n-i},(_,j)=>i+j).sort((p,q)=>Math.abs(a[q][i])-Math.abs(a[p][i]))[0];
    [a[i],a[pivot]]=[a[pivot],a[i]];
    if(Math.abs(a[i][i])<1e-12)throw Error('Dependent ability constraints');
    const scale=a[i][i];a[i]=a[i].map(x=>x/scale);
    for(let j=0;j<n;j++)if(j!==i){const f=a[j][i];a[j]=a[j].map((x,k)=>x-f*a[i][k]);}
  }
  return a.map(row=>row[n]);
}
function sourceHash() {
  const files=['engine.ts','input.ts','scoring.ts','statistics.ts','types.ts','report.ts'].map(f=>path.join('packages/simulation-core/src/match',f))
    .concat(['random.ts','roleRatings.ts','config.ts','types.ts'].map(f=>path.join('packages/simulation-core/src',f)));
  return hash(files.map(f=>fs.readFileSync(f,'utf8')).join('\n'));
}
function validate(r) {
  if(r.status!=='complete'||r.scores[r.winner]!==100||r.scores[1-r.winner]>=100||r.quarters.length!==4)throw Error('Illegal result');
  const win=r.events.findLast(e=>e.type==='score');
  if(win?.side!==r.winner||win.data?.kind!=='central_air'||!win.data?.winning)throw Error('Illegal winning kick');
  for(const side of [0,1]) {
    const ps=r.players.filter(p=>p.side===side);
    if(ps.reduce((s,p)=>s+(p.stats.points??0),0)!==r.scores[side]||r.teamStats[side].points!==r.scores[side]||
      r.quarters.reduce((s,q)=>s+q.points[side],0)!==r.scores[side])throw Error('Points/quarters mismatch');
    for(const k of new Set(ps.flatMap(p=>Object.keys(p.stats))))if(ps.reduce((s,p)=>s+(p.stats[k]??0),0)!==(r.teamStats[side][k]??0))throw Error('Player/team stat mismatch');
    if(Math.abs(ps.reduce((s,p)=>s+p.secondsPlayed,0)-r.teamStats[side].playerSeconds)>1e-6)throw Error('Time mismatch');
  }
}

if(!isMainThread) {
  const {rosters,tactics,tasks,output,manifest,changes}=workerData,snapshot=JSON.stringify(rosters);
  for(const task of tasks) {
    const {condition,a,b}=task,file=path.join(output,`${condition}-${a}-${b}.json`);
    if(fs.existsSync(file)) {
      const rows=JSON.parse(fs.readFileSync(file));
      if(rows.length!==50||rows.some((g,n)=>g.condition!==condition||g.a!==a||g.b!==b||g.seed!==`century-style-check-v0.1:${a}:${b}:${n}`))throw Error('Bad checkpoint');
      parentPort.postMessage(task);continue;
    }
    const rows=[];
    for(let n=0;n<50;n++) {
      const sides=n%2?[b,a]:[a,b];
      const input={id:`style-${condition}-${a}-${b}-${n}`,seed:`century-style-check-v0.1:${a}:${b}:${n}`,
        teams:sides.map(i=>condition==='adapted'&&i===b?{...rosters[i],coach:{...rosters[i].coach,tactics:tactics[i]}}:rosters[i]),
        provenance:{engineSourceSHA256:manifest.engineSourceSHA256,condition,diagnostic:'synthetic ability-preserving roster; no official player changes'}};
      const r=simulateMatch(input);validate(r);const side=sides.indexOf(a),brief=matchBriefing(r);
      const exposure=[a,b].map(i=>{
        const ps=r.players.filter(p=>p.side===sides.indexOf(i));
        const material=new Set(changes[i].filter(p=>p.maxAbsoluteChange>=.25).map(p=>p.id));
        const total=ps.reduce((s,p)=>s+p.secondsPlayed,0);
        return {teamIndex:i,totalPlayerSeconds:total,materiallyChangedSeconds:ps.filter(p=>material.has(p.id)).reduce((s,p)=>s+p.secondsPlayed,0),
          weightedMeanAbsoluteChange:ps.reduce((s,p)=>s+p.secondsPlayed*changes[i].find(q=>q.id===p.id).meanAbsoluteChange,0)/total};
      });
      rows.push({id:input.id,seed:input.seed,condition,a,b,sides,winner:sides[r.winner],scores:[r.scores[side],r.scores[1-side]],
        signedMargin:r.scores[side]-r.scores[1-side],playingMinutes:r.playingSeconds/60,
        teamStats:[r.teamStats[side],r.teamStats[1-side]],players:r.players.map(p=>({...p,teamIndex:sides[p.side]})),
        quarters:r.quarters.map(q=>({...q,points:[q.points[side],q.points[1-side]],cumulative:[q.cumulative[side],q.cumulative[1-side]]})),
        winningPlay:brief.winningPlay,exposure});
      if(n===0)atomic(path.join(output,'samples',input.id+'.json'),r);
    }
    if(JSON.stringify(rosters)!==snapshot)throw Error('Input mutated');
    atomic(file,rows);parentPort.postMessage(task);
  }
} else {
  const args=process.argv.slice(2),option=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];};
  const study=path.resolve(option('--study','league-balance-study')),output=path.resolve(option('--output','style-viability-study'));
  const workers=Number(option('--workers','6'));
  if(!Number.isInteger(workers)||workers<1||workers>16)throw Error('Use 1–16 workers');
  const canonicalText=fs.readFileSync(path.join(study,'teams.json'),'utf8'),canonical=JSON.parse(canonicalText);
  const source=JSON.parse(fs.readFileSync(path.join(study,'manifest.json'),'utf8'));
  if(hash(JSON.stringify(canonical))!==source.inputSHA256)throw Error('Source roster hash differs');
  const engineSourceSHA256=sourceHash();
  if(engineSourceSHA256!==source.engineSourceSHA256)throw Error('Gameplay changed since the full-league study');
  const base=canonical.find(t=>t.name==='Roanoke Athletic');
  if(!base)throw Error('Missing prespecified source roster');
  const keys=Object.keys(base.players[0].ratings),fixed=['stamina','durability','recovery','discipline'];
  const constraints=[keys.map(()=>1),...Object.values(ROLE_WEIGHTS).map(weights=>keys.map(k=>weights[k]??0)),...fixed.map(k=>keys.map(q=>q===k?1:0))];
  const gram=constraints.map(a=>constraints.map(b=>dot(a,b)));
  const profiles=[
    {name:'Original mix',key:'mixed',targets:{},tactics:{}},
    {name:'Ball-winning',key:'ballwinning',targets:{contestedPossession:1,groundBallSkill:1,strength:1,verticalLeap:1},
      tactics:{physicality:4,pressure:4,ball_risk:2,width:2}},
    {name:'Finishing',key:'finishing',targets:{kickingAccuracy:1,kickingOnRun:1,composure:1,kickingPower:.5},
      tactics:{ball_risk:4,transition_emphasis:4,aerial_emphasis:4,tempo:4}},
    {name:'Distribution',key:'distribution',targets:{handPassing:1,decisionMaking:1,kickingAccuracy:1,awareness:.5,oppositeSideSkill:.5},
      tactics:{ball_risk:2,running_movement_emphasis:4,width:4,aerial_emphasis:2}},
    {name:'Running',key:'running',targets:{speed:1,acceleration:1,agility:1,evasion:1,ballCarrying:1},
      tactics:{running_movement_emphasis:4,tempo:4,ball_risk:2,aerial_emphasis:2}},
    {name:'Aerial',key:'aerial',targets:{aerialMarking:1,verticalLeap:1,anticipation:.5,defensiveSpoiling:.5},
      tactics:{aerial_emphasis:4,width:4,ball_risk:4,running_movement_emphasis:2}}
  ];
  const neutral=Object.fromEntries(TACTIC_KEYS.map(k=>[k,3])),changes=[],directions=[];
  const rosters=profiles.map((profile,index)=>{
    const target=keys.map(k=>profile.targets[k]??0),multipliers=solve(gram,constraints.map(a=>dot(a,target)));
    let direction=target.map((v,i)=>v-constraints.reduce((s,a,j)=>s+a[i]*multipliers[j],0));
    const max=Math.max(...direction.map(Math.abs));direction=direction.map(v=>max>0?v*2/max:0);directions.push(Object.fromEntries(keys.map((k,i)=>[k,direction[i]])));
    const deltaRows=[];
    const players=base.players.map((old,n)=>{
      let scale=1;
      for(let i=0;i<keys.length;i++)if(direction[i]>1e-10)scale=Math.min(scale,(20-old.ratings[keys[i]])/direction[i]);
        else if(direction[i]<-1e-10)scale=Math.min(scale,(1-old.ratings[keys[i]])/direction[i]);
      const ratings=Object.fromEntries(keys.map((k,i)=>[k,old.ratings[k]+scale*direction[i]]));
      const id=`style-${profile.key}-player-${n}`,deltas=keys.map(k=>ratings[k]-old.ratings[k]);
      const before=calculateRoleRatings(old.ratings),after=calculateRoleRatings(ratings);
      for(const k of ['defensiveRating','centralRating','attackingRating','overallRating'])if(Math.abs(before[k]-after[k])>1e-9)throw Error('Broad ability changed');
      if(Math.abs(mean(Object.values(ratings))-mean(Object.values(old.ratings)))>1e-9||fixed.some(k=>Math.abs(ratings[k]-old.ratings[k])>1e-9))throw Error('Attribute budget/administration changed');
      if(Object.values(ratings).some(v=>!Number.isFinite(v)||v<1-1e-10||v>20+1e-10))throw Error('Out-of-range synthetic attribute');
      deltaRows.push({id,sourcePlayerId:old.id,maxAbsoluteChange:Math.max(...deltas.map(Math.abs)),meanAbsoluteChange:mean(deltas.map(Math.abs)),scale});
      return {id,name:`Diagnostic player ${n+1}`,ratings};
    });
    changes.push(deltaRows);
    return {id:`diagnostic-${profile.key}`,name:profile.name,coach:{name:'Diagnostic coach',tactics:{...neutral}},players};
  });
  const tactics=profiles.map(p=>({...neutral,...p.tactics}));
  const attributes=rosters.map((team,i)=>({index:i,name:team.name,
    means:Object.fromEntries(keys.map(k=>[k,mean(team.players.map(p=>p.ratings[k]))])),
    meanRaw:mean(team.players.map(p=>mean(Object.values(p.ratings)))),
    roleMeans:Object.fromEntries(['defensiveRating','centralRating','attackingRating','overallRating'].map(k=>[k,mean(team.players.map(p=>calculateRoleRatings(p.ratings)[k]))])),
    materialPlayers:changes[i].filter(p=>p.maxAbsoluteChange>=.25).length,
    meanAbsoluteChange:mean(changes[i].map(p=>p.meanAbsoluteChange))}));
  if(attributes.slice(1).some(a=>a.materialPlayers<32))throw Error('Changes do not cover the playing unit');
  const tasks=rosters.flatMap((_,a)=>rosters.slice(a+1).map((_,j)=>({condition:'neutral',a,b:a+1+j})))
    .concat(profiles.slice(1).map((_,j)=>({condition:'adapted',a:0,b:j+1})));
  const manifest={engineVersion:MATCH_ENGINE_VERSION,engineSourceCommit:source.engineSourceCommit,engineSourceSHA256,
    sourceInputSHA256:source.inputSHA256,sourceRoster:base.name,
    study:'Two final diagnostics, not official player changes or signings',profiles:profiles.map(({name,key,targets})=>({name,key,targets})),
    construction:'Project target directions onto the nullspace of raw-attribute sum, all three role ratings and fixed attributes; normalize maximum individual change to 2 and shrink only to stay within 1–20.',
    preservedPerPlayer:['raw attribute mean','defensive rating','central rating','attacking rating','Overall',...fixed],
    neutralPairs:15,adaptedPairs:5,matchesPerSeries:50,expectedMatches:1000,sideAppearancesPerSeries:[25,25],
    adaptedCondition:'Only the specialist coach changes; the original-mix opponent remains neutral. One prespecified plausible preset per specialist, not an optimal strategy search.',
    seedScheme:'century-style-check-v0.1:{a}:{b}:{n}',
    seedPairing:'Adapted-vs-mixed trials reuse the neutral-vs-mixed seeds/sides; different decisions can desynchronize subsequent draws.',
    rostersSHA256:hash(JSON.stringify(rosters)),tacticsSHA256:hash(JSON.stringify(tactics)),
    stoppingRule:'Exactly 750 neutral and 250 adapted matches. No outcome-based stopping, profile selection or tactic tuning.',
    interpretation:'Matched summary ratings are controls, not proof of equal true match strength; this is a synthetic local composition probe on one base roster.'};
  fs.mkdirSync(path.join(output,'samples'),{recursive:true});
  const mf=path.join(output,'manifest.json');
  if(fs.existsSync(mf)&&JSON.stringify(JSON.parse(fs.readFileSync(mf)))!==JSON.stringify(manifest))throw Error('Existing study differs');
  atomic(mf,manifest);atomic(path.join(output,'rosters.json'),{rosters,tactics,changes,directions,attributes});
  if(args.includes('--prepare-only')){console.log(JSON.stringify({manifest,attributes},null,2));process.exit(0);}
  let completed=0;
  await Promise.all(Array.from({length:Math.min(workers,tasks.length)},(_,i)=>new Promise((resolve,reject)=>{
    const w=new Worker(new URL(import.meta.url),{workerData:{rosters,tactics,changes,manifest,output,tasks:tasks.filter((_,j)=>j%workers===i)}});
    w.on('message',()=>{completed++;console.log(`Series ${completed}/${tasks.length}; matches ${completed*50}/1000`);});
    w.on('error',reject);w.on('exit',code=>code?reject(Error(`Worker exit ${code}`)):resolve());
  })));
  const series=[],all=[];
  for(const task of tasks){
    const rows=JSON.parse(fs.readFileSync(path.join(output,`${task.condition}-${task.a}-${task.b}.json`)));all.push(...rows);
    const aWins=rows.filter(g=>g.winner===task.a).length;
    series.push({...task,aName:profiles[task.a].name,bName:profiles[task.b].name,aWins,bWins:50-aWins,wilson95A:wilson(aWins,50),
      meanSignedMargin:mean(rows.map(g=>g.signedMargin)),closeWithin10:rows.filter(g=>Math.abs(g.signedMargin)<=10).length});
  }
  const neutralGames=all.filter(g=>g.condition==='neutral');
  const clubs=profiles.map((p,i)=>{
    const rows=neutralGames.filter(g=>g.a===i||g.b===i),own=(g)=>g.a===i?0:1,wins=rows.filter(g=>g.winner===i).length;
    const total=(key,other=false)=>rows.reduce((s,g)=>s+(g.teamStats[other?1-own(g):own(g)][key]??0),0);
    const exposures=rows.flatMap(g=>g.exposure.filter(e=>e.teamIndex===i)),seconds=exposures.reduce((s,e)=>s+e.totalPlayerSeconds,0);
    return {index:i,name:p.name,wins,losses:250-wins,winRate:wins/250,wilson95:wilson(wins,250),
      shotShare:total('shots')/(total('shots')+total('shots',true)),ballUpShare:total('ballUpsWon')/(total('ballUpsWon')+total('ballUpsWon',true)),
      groundShare:total('recoveries')/(total('recoveries')+total('recoveries',true)),pointsPerShot:total('points')/total('shots'),
      materiallyChangedTimeShare:exposures.reduce((s,e)=>s+e.materiallyChangedSeconds,0)/seconds,
      weightedMeanAbsoluteChange:exposures.reduce((s,e)=>s+e.weightedMeanAbsoluteChange*e.totalPlayerSeconds,0)/seconds};
  });
  if(clubs.slice(1).some(c=>c.materiallyChangedTimeShare<.9))throw Error('Playing-unit exposure below 90%');
  const tactical=profiles.slice(1).map((p,j)=>{
    const b=j+1,neutralRows=all.filter(g=>g.condition==='neutral'&&g.a===0&&g.b===b),adaptedRows=all.filter(g=>g.condition==='adapted'&&g.b===b);
    let gained=0,lost=0;
    for(let n=0;n<50;n++) {
      const u=neutralRows[n],v=adaptedRows[n];
      if(u.seed!==v.seed||JSON.stringify(u.sides)!==JSON.stringify(v.sides))throw Error('Unpaired tactical trial');
      if(u.winner===0&&v.winner===b)gained++;if(u.winner===b&&v.winner===0)lost++;
    }
    const nWins=neutralRows.filter(g=>g.winner===b).length,aWins=adaptedRows.filter(g=>g.winner===b).length;
    return {index:b,name:p.name,neutralWins:nWins,adaptedWins:aWins,winChange:aWins-nWins,gained,lost,
      neutralWilson95:wilson(nWins,50),adaptedWilson95:wilson(aWins,50),
      neutralMeanMargin:-mean(neutralRows.map(g=>g.signedMargin)),adaptedMeanMargin:-mean(adaptedRows.map(g=>g.signedMargin)),
      tactics:tactics[b]};
  });
  if(all.length!==1000||new Set(all.map(g=>g.id)).size!==1000||new Set(neutralGames.map(g=>g.seed)).size!==750)throw Error('Incomplete study');
  if(fs.readFileSync(path.join(study,'teams.json'),'utf8')!==canonicalText||sourceHash()!==engineSourceSHA256)throw Error('Source changed');
  const stream=fs.createWriteStream(path.join(output,'matches.ndjson'));
  for(const g of all)if(!stream.write(JSON.stringify(g)+'\n'))await new Promise(resolve=>stream.once('drain',resolve));
  await new Promise(resolve=>stream.end(resolve));
  let replayedSamples=0,isolatedCoachComparisons=0;
  const samples=fs.readdirSync(path.join(output,'samples')).filter(f=>f.endsWith('.json')).sort();
  for(const file of samples) {
    const saved=JSON.parse(fs.readFileSync(path.join(output,'samples',file)));
    if(JSON.stringify(simulateMatch(saved.input))!==JSON.stringify(saved))throw Error(`Replay mismatch: ${file}`);
    replayedSamples++;
  }
  for(let b=1;b<6;b++) {
    const inputs=['neutral','adapted'].map(c=>JSON.parse(fs.readFileSync(path.join(output,'samples',`style-${c}-0-${b}-0.json`))).input);
    if(JSON.stringify(inputs[0].teams[0])!==JSON.stringify(inputs[1].teams[0])||
      JSON.stringify(inputs[0].teams[1].players)!==JSON.stringify(inputs[1].teams[1].players))throw Error('Tactical comparison changed opponent/players');
    isolatedCoachComparisons++;
  }
  if(replayedSamples!==20)throw Error('Incomplete replay coverage');
  const verification={status:'passed',matches:1000,neutralMatches:750,adaptedMatches:250,replayedSamples,isolatedCoachComparisons,
    allPlayerStatsReconciled:true,allQuartersReconciled:true,allWinningKicksQualifying:true,
    minimumSpecialistChangedTimeShare:Math.min(...clubs.filter(c=>c.index>0).map(c=>c.materiallyChangedTimeShare)),
    canonicalSnapshotUnchanged:fs.readFileSync(path.join(study,'teams.json'),'utf8')===canonicalText,
    engineUnchanged:sourceHash()===engineSourceSHA256,perPlayerAbilityTolerance:1e-9};
  atomic(path.join(output,'verification.json'),verification);
  const result={manifest,attributes,clubs:clubs.sort((a,b)=>b.wins-a.wins),series,tactical,verification,
    meanPlayingMinutes:mean(all.map(g=>g.playingMinutes)),allStatsReconciled:true,canonicalSourcesUnchanged:true};
  atomic(path.join(output,'summary.json'),result);console.log(JSON.stringify({clubs:result.clubs,tactical},null,2));
}
