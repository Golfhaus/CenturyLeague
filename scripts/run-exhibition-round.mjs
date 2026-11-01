import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRandom } from '../packages/simulation-core/dist/random.js';
import { importDraftedTeams, simulateMatch, matchBriefing, matchReportMarkdown, MATCH_ENGINE_VERSION } from '../packages/simulation-core/dist/match/index.js';

const args=process.argv.slice(2),option=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];};
const files=['--players','--draft','--coaches'].map(k=>option(k));
if(files.some(f=>!f))throw Error('Supply --players, --draft and --coaches');
const roundId=option('--round-id','exhibition-round-01');
if(!/^[a-z0-9-]{1,80}$/.test(roundId))throw Error('Use a lowercase alphanumeric round ID with optional hyphens');
const drawSeed=option('--draw-seed',`century-${roundId}-draw-v0.1`),output=path.resolve(option('--output',roundId));
const raw=files.map(f=>fs.readFileSync(f,'utf8')),draft=JSON.parse(raw[1]);
if(!draft.draft_complete||draft.rounds_completed!==35)throw Error('Complete draft required');
const teams=importDraftedTeams(JSON.parse(raw[0]),draft.picks,JSON.parse(raw[2]).coaches);
const snapshot=JSON.stringify(teams),hash=s=>createHash('sha256').update(s).digest('hex');
const sourceFiles=['engine.ts','input.ts','scoring.ts','statistics.ts','types.ts','report.ts'].map(f=>path.join('packages/simulation-core/src/match',f))
  .concat(['random.ts','roleRatings.ts','config.ts','types.ts'].map(f=>path.join('packages/simulation-core/src',f)));
const engineSourceSHA256=hash(sourceFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n'));
const order=teams.map((_,i)=>i),rng=createRandom(drawSeed);
for(let i=order.length-1;i>0;i--){const j=Math.floor(rng.next()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
const fixtures=Array.from({length:9},(_,i)=>({number:i+1,id:`${roundId}-${String(i+1).padStart(2,'0')}`,
  seed:`century-${roundId}:match:${i+1}`,indices:order.slice(i*2,i*2+2),teams:order.slice(i*2,i*2+2).map(j=>teams[j].name)}));
if(new Set(fixtures.flatMap(f=>f.indices)).size!==18)throw Error('Each club must feature exactly once');
const manifest={roundId,status:'exhibition',engineVersion:MATCH_ENGINE_VERSION,engineSourceSHA256,
  drawSeed,drawMethod:'Seeded Fisher–Yates shuffle of the canonical draft team order, adjacent clubs paired; no strength seeding or outcome-based redraws.',
  sourceSHA256:raw.map(hash),inputSHA256:hash(snapshot),fixtures,
  condition:'All 18 actual drafted rosters and original coach preferences; rested/healthy for each match; no home-advantage coefficient.',
  carryover:'None; no standings, ratings, roster assignments or persistent injuries are updated.',
  stoppingRule:'One fixed-seed match per fixture. Keep every result. No result-based rerolls.'};
fs.mkdirSync(output,{recursive:true});
const mf=path.join(output,'manifest.json');
if(fs.existsSync(mf)&&JSON.stringify(JSON.parse(fs.readFileSync(mf)))!==JSON.stringify(manifest))throw Error('Existing round differs');
fs.writeFileSync(mf,JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(output,'teams.json'),snapshot);
if(args.includes('--prepare-only')){console.log(JSON.stringify(fixtures,null,2));process.exit(0);}
const briefs=[],facts=[],roundPlayers=[];
for(const fixture of fixtures) {
  const file=path.join(output,fixture.id+'.json');let r;
  if(fs.existsSync(file)) {
    r=JSON.parse(fs.readFileSync(file));
    if(r.seed!==fixture.seed||JSON.stringify(r.input.teams)!==JSON.stringify(fixture.indices.map(i=>teams[i])))throw Error('Saved fixture differs');
  }else {
    r=simulateMatch({id:fixture.id,seed:fixture.seed,teams:fixture.indices.map(i=>teams[i]),
      provenance:{roundId,engineSourceSHA256,inputSHA256:manifest.inputSHA256,playerSnapshotSHA256:manifest.sourceSHA256[0],
        draftSHA256:manifest.sourceSHA256[1],coachesSHA256:manifest.sourceSHA256[2]}});
    fs.writeFileSync(file+'.tmp',JSON.stringify(r));fs.renameSync(file+'.tmp',file);
  }
  if(r.status!=='complete'||r.scores[r.winner]!==100||r.scores[1-r.winner]>=100||r.quarters.length!==4)throw Error('Illegal result');
  const last=r.events.findLast(e=>e.type==='score');
  if(last?.side!==r.winner||last.data?.kind!=='central_air'||!last.data?.winning)throw Error('Illegal winning play');
  for(const side of [0,1]) {
    const ps=r.players.filter(p=>p.side===side);
    if(ps.length!==35||ps.reduce((s,p)=>s+(p.stats.points??0),0)!==r.scores[side]||r.teamStats[side].points!==r.scores[side]||
      r.quarters.reduce((s,q)=>s+q.points[side],0)!==r.scores[side])throw Error('Score/quarter reconciliation failed');
    for(const key of new Set(ps.flatMap(p=>Object.keys(p.stats))))if(ps.reduce((s,p)=>s+(p.stats[key]??0),0)!==(r.teamStats[side][key]??0))throw Error('Player/team stat reconciliation failed');
    if(Math.abs(ps.reduce((s,p)=>s+p.secondsPlayed,0)-r.teamStats[side].playerSeconds)>1e-6)throw Error('Playing-time reconciliation failed');
  }
  if(JSON.stringify(simulateMatch(r.input))!==JSON.stringify(r))throw Error('Exact replay failed');
  const b=matchBriefing(r);briefs.push(b);
  let winnerDeficit=0,winnerLargestLead=0,loserLargestLead=0;
  for(const e of r.events.filter(e=>e.type==='score')) {
    const scores=e.data.scores,margin=scores[r.winner]-scores[1-r.winner];
    winnerDeficit=Math.max(winnerDeficit,-margin);winnerLargestLead=Math.max(winnerLargestLead,margin);loserLargestLead=Math.max(loserLargestLead,-margin);
  }
  const leaders=[0,1].map(side=>{
    const ps=r.players.filter(p=>p.side===side);
    const top=key=>{const max=Math.max(...ps.map(p=>p.stats[key]??0));return {value:max,players:ps.filter(p=>(p.stats[key]??0)===max).map(p=>({id:p.id,name:p.name}))};};
    return {team:r.input.teams[side].name,points:top('points'),shots:top('shots'),ballUps:top('ballUpsWon'),recoveries:top('recoveries'),tackles:top('tackles'),catches:top('catches')};
  });
  roundPlayers.push(...r.players.map(p=>({...p,team:r.input.teams[p.side].name,matchId:r.id})));
  facts.push({number:fixture.number,id:r.id,teams:fixture.teams,scores:r.scores,winnerSide:r.winner,winner:b.winner,
    margin:100-r.scores[1-r.winner],winnerLargestDeficit:winnerDeficit,winnerLargestLead,loserLargestLead,
    quarterCumulative:r.quarters.map(q=>q.cumulative),quarterPoints:r.quarters.map(q=>q.points),
    leadChanges:b.leadChanges,largestScoringRun:{...b.largestScoringRun,team:fixture.teams[b.largestScoringRun.side]},
    teamStats:r.teamStats,leaders,participants:[0,1].map(side=>r.players.filter(p=>p.side===side&&p.secondsPlayed>0).length),
    playingMinutes:b.playingMinutes,elapsedMinutes:b.elapsedMinutes,winningPlay:b.winningPlay,incidents:b.noteworthy});
  fs.writeFileSync(path.join(output,fixture.id+'.md'),matchReportMarkdown(r));
  console.log(`${fixture.number}. ${fixture.teams[0]} ${r.scores[0]}–${r.scores[1]} ${fixture.teams[1]}`);
}
if(hash(JSON.stringify(teams))!==manifest.inputSHA256||raw.some((text,i)=>fs.readFileSync(files[i],'utf8')!==text))throw Error('Canonical input changed');
const leaders=key=>[...roundPlayers].sort((a,b)=>(b.stats[key]??0)-(a.stats[key]??0)||a.id.localeCompare(b.id)).slice(0,10)
  .map(p=>({id:p.id,name:p.name,team:p.team,matchId:p.matchId,value:p.stats[key]??0,minutes:p.secondsPlayed/60,stats:p.stats}));
const round={roundId,status:'exhibition',manifest,matches:facts,
  totals:{matches:9,teams:18,eligiblePlayers:roundPlayers.length,points:facts.reduce((s,f)=>s+f.scores[0]+f.scores[1],0),
    shots:facts.reduce((s,f)=>s+f.teamStats[0].shots+f.teamStats[1].shots,0),
    meanPlayingMinutes:facts.reduce((s,f)=>s+f.playingMinutes,0)/9,
    closeWithin10:facts.filter(f=>f.margin<=10).length},
  leaders:{points:leaders('points'),ballUps:leaders('ballUpsWon'),recoveries:leaders('recoveries'),tackles:leaders('tackles'),catches:leaders('catches')},
  verification:{status:'passed',matches:9,uniqueTeams:18,eligiblePlayers:630,replayedMatches:9,
    allPlayerStatsReconciled:true,allQuarterPointsReconciled:true,allWinningKicksQualifying:true,canonicalSourcesUnchanged:true},
  evidencePolicy:'Summaries may use only recorded facts. Do not invent quotes, tactical intent, venues, crowds, diagnoses or persistent injuries. This round does not create official standings.'};
fs.writeFileSync(path.join(output,'round.json'),JSON.stringify(round,null,2));
fs.writeFileSync(path.join(output,'round_briefing.json'),JSON.stringify({status:'exhibition',roundId,matches:briefs,leaders:round.leaders,evidencePolicy:round.evidencePolicy},null,2));
console.log(JSON.stringify({totals:round.totals,verification:round.verification},null,2));
