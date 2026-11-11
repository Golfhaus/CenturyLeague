import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { labRoot, baseline, hash, readJSON, atomicJSON, loadEngines, syntheticTeams, sourceFingerprint, verifyBaseline, verifyImportBoundary } from './tools.mjs';
const args=process.argv.slice(2),opts={};
for(let i=0;i<args.length;i+=2){assert.ok(['--study-id','--trials','--workers','--date'].includes(args[i])&&args[i+1]&&!args[i+1].startsWith('--'),'Invalid option');assert.ok(!(args[i]in opts),'Duplicate option');opts[args[i]]=args[i+1];}
const studyId=opts['--study-id'],trials=Number(opts['--trials']??64),workers=Number(opts['--workers']??Math.min(4,availableParallelism())),matchDate=opts['--date']??'2026-11-11';
assert.match(studyId??'',/^[a-z0-9][a-z0-9-]{0,79}$/);
assert.ok(Number.isSafeInteger(trials)&&trials>=2&&trials<=10000&&trials%2===0,'Even trials required');
assert.ok(Number.isSafeInteger(workers)&&workers>=1&&workers<=8,'Use 1–8 workers');
const e=await loadEngines(),sourceSHA256=sourceFingerprint();
const [a]=syntheticTeams(e);
const mirror=(id,pressure)=>{
 const first=structuredClone(a);first.id=`${id}-A`;first.name=`Synthetic ${id} A`;
 first.players=first.players.map((p,i)=>({...p,id:`${id}-A-${i}`,name:`Synthetic ${id} A ${i}`}));
 if(pressure){Object.assign(first.coach.tactics,{pressure:5,defensive_aggression:5,physicality:4,running_movement_emphasis:5});}
 const second=structuredClone(first);second.id=`${id}-B`;second.name=`Synthetic ${id} B`;
 second.players=second.players.map((p,i)=>({...p,id:`${id}-B-${i}`,name:`Synthetic ${id} B ${i}`}));
 return{id,teams:[first,second]};
};
const profiles=[mirror('neutral',false),mirror('pressure',true)];
const arms=[
 {id:'control',enabled:[],focal:0,opponent:0},
 {id:'confidence-3',enabled:['confidence'],focal:3,opponent:0},
 {id:'confidence-5',enabled:['confidence'],focal:5,opponent:0},
 {id:'frustration-3',enabled:['frustration'],focal:-3,opponent:0},
 {id:'frustration-5',enabled:['frustration'],focal:-5,opponent:0},
 {id:'combined-3',enabled:['confidence','frustration'],focal:3,opponent:-3}
];
const fixtures=profiles.flatMap(profile=>Array.from({length:trials},(_,trial)=>({id:`${studyId}-${profile.id}-${trial}`,profile:profile.id,trial,swap:Boolean(trial%2),seed:`century-streak-study:${studyId}:${profile.id}:${trial}`})));
const coefficients={confidenceOddsPerExtraWin:.005,confidenceOddsCap:.02,frustrationRelativePerExtraLoss:.02,frustrationRelativeCap:.08,disciplineDamping:'(21 - Discipline) / 20',scales:[1,1],baselineSeverityProbability:.09};
const manifest={schema:'century-streak-study-v1',classification:'lab-only',studyId,experiment:'confidence-frustration-pilot',baselineCommit:baseline.sourceCommit,sourceSHA256,matchDate,
 profiles,profilesSHA256:hash(JSON.stringify(profiles)),arms,coefficients,fixtures,trialsPerProfile:trials,
 stoppingRule:'Complete all prespecified fixtures and arms, retain every outcome; no outcome-based tuning or stopping.',
 seedPolicy:'Matched seeds across arms; side-balanced independent trials. Divergent decisions can desynchronize later draws.',
 replayPolicy:'Full replay of first fixture of each profile/arm; every saved result replays on resumption. Frozen v1.0 control checked for first fixture per profile.',
 interpretation:'Synthetic mirror-roster pilot, not actual club performance. Within-arm weather/home/halftime effects absent. No persistent histories.',
 thresholds:'No win-rate acceptance threshold is applied to this small pilot. Report observed effects and uncertainty; use fresh seeds for confirmation.'};
const dir=path.join(labRoot,'runs',studyId);fs.mkdirSync(dir,{recursive:true});
const manifestPath=path.join(dir,'manifest.json');
if(fs.existsSync(manifestPath))assert.deepEqual(readJSON(manifestPath),manifest,'Study changed; choose new study ID');else atomicJSON(manifestPath,manifest,true);
const records=[],pool=[];let next=0,resumed=0;
try {
 await new Promise((resolve,reject)=>{
  let finished=0,failed=false;
  function fail(error){if(!failed){failed=true;reject(error);}}
  for(let index=0;index<Math.min(workers,fixtures.length);index++) {
   const worker=new Worker(new URL('./streak-worker.mjs',import.meta.url),{workerData:{dir,profiles,arms,matchDate}});pool.push(worker);
   worker.on('error',fail);worker.on('exit',code=>{if(code!==0&&!failed&&finished<fixtures.length)fail(Error(`Worker exited ${code}`));});
   worker.on('message',message=>{
    if(failed)return;if(message.error){fail(Error(`${message.fixtureId}: ${message.error}`));return;}
    records.push(message.record);resumed+=Number(message.resumed);finished++;
    if(finished%16===0||finished===fixtures.length)console.log(JSON.stringify({completedFixtures:finished,totalFixtures:fixtures.length,engineResults:finished*arms.length}));
    if(finished===fixtures.length){resolve();return;}if(next<fixtures.length)worker.postMessage(fixtures[next++]);
   });
   if(next<fixtures.length)worker.postMessage(fixtures[next++]);
  }
 });
}finally{await Promise.all(pool.map(worker=>worker.terminate()));}
records.sort((a,b)=>fixtures.findIndex(x=>x.id===a.fixture.id)-fixtures.findIndex(x=>x.id===b.fixture.id));
verifyBaseline();verifyImportBoundary();assert.equal(sourceFingerprint(),sourceSHA256,'Source changed during study');
const sum=(rows,key)=>rows.reduce((s,row)=>s+row[key],0);
function wilson(successes,n,z=1.96){
 const p=successes/n,d=1+z*z/n,m=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,m-h),Math.min(1,m+h)];
}
function summarize(subset){
 const summaries=arms.map(arm=>{
  const rows=subset.map(r=>r.arms.find(a=>a.id===arm.id)),n=rows.length,wins=sum(rows,'focalWin');
  const differences=rows.map((r,i)=>r.focalWin-subset[i].arms.find(a=>a.id==='control').focalWin);
  const delta=differences.reduce((a,b)=>a+b,0)/n;
  const variance=differences.reduce((s,x)=>s+(x-delta)**2,0)/Math.max(1,n-1),se=Math.sqrt(variance/n);
  const z=1.96,phat=wins/n,denom=1+z*z/n,mid=(phat+z*z/(2*n))/denom,half=z*Math.sqrt(phat*(1-phat)/n+z*z/(4*n*n))/denom;
  const foulOpportunities=sum(rows,'foulOpportunities'),seriousFouls=sum(rows,'seriousFouls');
  const positive=differences.filter(x=>x===1).length,negative=differences.filter(x=>x===-1).length;
  const plus=wilson(positive,n,2.241403),minus=wilson(negative,n,2.241403);
  const conservative=[Math.max(-1,plus[0]-minus[1]),Math.min(1,plus[1]-minus[0])];
  return{id:arm.id,matches:n,wins,winRate:phat,winRate95Wilson:[mid-half,mid+half],
   pairedWinRateDifference:delta,pairedWinRateDifference95Approx:[Math.max(-1,delta-z*se),Math.min(1,delta+z*se)],
   pairedDifference95ConservativeWilson:conservative,pairedIntervalMethod:'Bonferroni combination of Wilson intervals for positive and negative discordance; avoids zero-width interval when no winners change.',
   discordantWins:positive,discordantLosses:negative,
   meanFocalScore:sum(rows,'focalScore')/n,meanOpponentScore:sum(rows,'opponentScore')/n,
   meanScoreMargin:rows.reduce((s,r)=>s+r.focalScore-r.opponentScore,0)/n,
   contacts:sum(rows,'contacts'),foulOpportunities,seriousFouls,seriousPerFoul:foulOpportunities?seriousFouls/foulOpportunities:null,
   opponentFoulOpportunities:sum(rows,'opponentFoulOpportunities'),opponentSeriousFouls:sum(rows,'opponentSeriousFouls'),
   expectedSeverityGivenObservedFouls:sum(rows,'adjustedSeverityProbabilitySum'),
   meanSeverityProbability:foulOpportunities?sum(rows,'adjustedSeverityProbabilitySum')/foulOpportunities:null,
   severityThresholdChanges:sum(rows,'severityThresholdChanges'),confidenceChecks:sum(rows,'confidenceChecks'),confidenceThresholdChanges:sum(rows,'confidenceThresholdChanges')};
 });
 return summaries;
}
const summary={schema:'century-streak-pilot-summary-v1',studyId,status:'completed',classification:'lab-only',sourceSHA256,
 matchedFixtures:fixtures.length,engineResults:fixtures.length*arms.length,fullReplays:profiles.length*arms.length,frozenControls:profiles.length,resumedFixtures:resumed,
 coefficients,arms:summarize(records),profiles:profiles.map(profile=>({id:profile.id,arms:summarize(records.filter(r=>r.fixture.profile===profile.id))})),
 interpretation:manifest.interpretation,limitations:['Small synthetic pilot; intervals may be wider than the proposed 2–4 percentage-point confidence target.','Aggregate serious-foul model only; no explicit retaliation taxonomy.','Severity rates condition on observed foul opportunities; match trajectories and denominators can change.','Paired intervals are approximate; the conservative Wilson combination is the primary interval, especially with few discordant winners.','No player-rating changes, official writes, live weather calls, calibration acceptance or adoption.'],
 records};
const summaryFile=path.join(dir,'summary.json');
// Resumption is operational metadata; immutable sporting results and manifest remain fixed.
if(fs.existsSync(summaryFile)){const previous=readJSON(summaryFile);previous.resumedFixtures=resumed;assert.deepEqual(previous,summary);}else atomicJSON(summaryFile,summary,true);
console.log(JSON.stringify({status:'completed',studyId,matchedFixtures:summary.matchedFixtures,engineResults:summary.engineResults,output:summaryFile,arms:summary.arms},null,2));
