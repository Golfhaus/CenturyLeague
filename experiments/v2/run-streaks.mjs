import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { labRoot, baseline, hash, readJSON, atomicJSON, loadEngines, syntheticTeams, sourceFingerprint, verifyBaseline, verifyImportBoundary } from './tools.mjs';
import { qualifyStudyRuntime, ensureQualifiedStudyProcess } from './runtime.mjs';
const args=process.argv.slice(2),opts={};
for(let i=0;i<args.length;i+=2){assert.ok(['--study-id','--trials','--workers','--date','--arms','--psychology-candidate'].includes(args[i])&&args[i+1]&&!args[i+1].startsWith('--'),'Invalid option');assert.ok(!(args[i]in opts),'Duplicate option');opts[args[i]]=args[i+1];}
const studyId=opts['--study-id'],trials=Number(opts['--trials']??64),workers=Number(opts['--workers']??Math.min(4,availableParallelism())),matchDate=opts['--date']??'2026-11-11';
assert.match(studyId??'',/^[a-z0-9][a-z0-9-]{0,79}$/);
assert.ok(Number.isSafeInteger(trials)&&trials>=2&&trials<=10000&&trials%2===0,'Even trials required');
assert.ok(Number.isSafeInteger(workers)&&workers>=1&&workers<=8,'Use 1–8 workers');
const armSet=opts['--arms']??'all';
assert.ok(['all','confidence','psychology','psychology-peak','psychology-calibration'].includes(armSet),'Invalid arm set');
const candidate=opts['--psychology-candidate']??'first-035';
assert.ok(['first-035','reduced-020'].includes(candidate),'Unknown psychological candidate');
assert.ok(armSet.startsWith('psychology')||!opts['--psychology-candidate'],'Psychological candidate requires psychological arms');
ensureQualifiedStudyProcess();
const runtime=qualifyStudyRuntime();
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
const allArms=[
 {id:'control',enabled:[],focal:0,opponent:0},
 {id:'confidence-3',enabled:['confidence'],focal:3,opponent:0},
 {id:'confidence-5',enabled:['confidence'],focal:5,opponent:0},
 {id:'frustration-3',enabled:['frustration'],focal:-3,opponent:0},
 {id:'frustration-5',enabled:['frustration'],focal:-5,opponent:0},
 {id:'combined-3',enabled:['confidence','frustration'],focal:3,opponent:-3}
];
const psychological=armSet.startsWith('psychology');
const sharedPolicy={version:'shared-psych-v1',homeOddsBonus:.004,maximumOddsBonus:candidate==='reduced-020'?.006:.009};
const confidenceScale=psychological ? (candidate==='reduced-020'?.20:.35) : 1;
const psychArms=[
 ...allArms.filter(arm=>['control','confidence-3','confidence-5'].includes(arm.id)).map(arm=>({...arm,home:null})),
 {id:'home-ordinary',enabled:['home-support'],focal:0,opponent:0,home:'focal'},
 {id:'home-hot-5',enabled:['home-support'],focal:5,opponent:0,home:'focal'},
 {id:'shared-hot-5',enabled:['confidence','home-support'],focal:5,opponent:0,home:'focal'},
 {id:'shared-full-5',enabled:['confidence','frustration','home-support'],focal:5,opponent:-5,home:'focal'},
 {id:'home-losing-5',enabled:['home-support'],focal:-5,opponent:0,home:'focal'},
 {id:'shared-adverse-5',enabled:['confidence','frustration','home-support'],focal:-5,opponent:5,home:'opponent'}
];
const arms=armSet==='psychology'?psychArms:armSet==='psychology-calibration'?psychArms.filter(arm=>['control','confidence-5','home-hot-5','shared-full-5'].includes(arm.id)):armSet==='psychology-peak'?psychArms.filter(arm=>['control','confidence-5','shared-full-5'].includes(arm.id)):armSet==='confidence'?allArms.filter(arm=>['control','confidence-3','confidence-5'].includes(arm.id)):allArms;
const fixtures=profiles.flatMap(profile=>Array.from({length:trials},(_,trial)=>({id:`${studyId}-${profile.id}-${trial}`,profile:profile.id,trial,swap:Boolean(trial%2),seed:`century-streak-study:${studyId}:${profile.id}:${trial}`})));
const coefficients={confidenceOddsPerExtraWin:.005,confidenceOddsCap:.02,frustrationRelativePerExtraLoss:.02,frustrationRelativeCap:.08,disciplineDamping:'(21 - Discipline) / 20',scales:[confidenceScale,1],baselineSeverityProbability:.09,...(psychological?{sharedPsychology:sharedPolicy}:{} )};
const manifest={schema:'century-streak-study-v1',classification:'lab-only',studyId,experiment:psychological?'shared-psychology-study':armSet==='confidence'?'confidence-precision-study':'confidence-frustration-pilot',armSet,...(psychological?{candidate}:{}),runtime,baselineCommit:baseline.sourceCommit,sourceSHA256,matchDate,
 profiles,profilesSHA256:hash(JSON.stringify(profiles)),arms,coefficients,fixtures,trialsPerProfile:trials,
 stoppingRule:'Complete all prespecified fixtures and arms, retain every outcome; no outcome-based tuning or stopping.',
 seedPolicy:'Matched seeds across arms; side-balanced independent trials. Divergent decisions can desynchronize later draws.',
 replayPolicy:'Full replay of first fixture of each profile/arm; every saved result replays on resumption. Frozen v1.0 control checked for first fixture per profile.',
 interpretation:psychological?'Synthetic mirror-roster shared-psychology study; home support only in explicitly named arms. Weather, temperature traits and halftime adaptation absent. No official histories.':'Synthetic mirror-roster pilot, not actual club performance. Within-arm weather/home/halftime effects absent. No persistent histories.',
 analysisPlan:{primaryContrast:psychological?'shared-full-5 minus control focal win probability on the same fixtures':'confidence-5 minus confidence-3 focal win probability on the same fixtures',primaryInterval:'Paired mean difference +/- 1.96 estimated standard errors; large-sample approximation',secondary:['Each confidence arm versus control','Paired score-margin differences','Separate neutral/pressure profile estimates'],priorDiscordancePlanningEstimate:.324,precisionDesign:psychological?'Exploratory screening followed by fixed fresh-seed confirmation; not a certification that the true psychological lift is below four points.':'6400 independent matched fixture seeds target approximately 1.4 percentage-point 95% half-width and about 80% power for a 2-point difference, conditional on prior discordance estimate. Not guaranteed.',decisionPolicy:'No coefficient changes or outcome-dependent stopping. Direction supported only if the primary 95% interval excludes zero; otherwise report unresolved direction, not equivalence or an engine bug.'},
 thresholds:'Report observed effects and uncertainty; no result-dependent stopping or adopted-coefficient decision.'};
const dir=path.join(labRoot,'runs',studyId);fs.mkdirSync(dir,{recursive:true});
const manifestPath=path.join(dir,'manifest.json');
if(fs.existsSync(manifestPath))assert.deepEqual(readJSON(manifestPath),manifest,'Study changed; choose new study ID');else atomicJSON(manifestPath,manifest,true);
const records=[],pool=[];let next=0,resumed=0;
try {
 await new Promise((resolve,reject)=>{
  let finished=0,failed=false;
  function fail(error){if(!failed){failed=true;reject(error);}}
  for(let index=0;index<Math.min(workers,fixtures.length);index++) {
   const worker=new Worker(new URL('./streak-worker.mjs',import.meta.url),{workerData:{dir,profiles,arms,matchDate,confidenceScale,requiredExecArgv:runtime.workerExecArgv,...(psychological?{sharedPolicy}:{} )}});pool.push(worker);
   worker.on('error',fail);worker.on('exit',code=>{if(code!==0&&!failed&&finished<fixtures.length)fail(Error(`Worker exited ${code}`));});
   worker.on('message',message=>{
    if(failed)return;if(message.error){fail(Error(`${message.fixtureId}: ${message.error}`));return;}
    records.push(message.record);resumed+=Number(message.resumed);finished++;
    if(finished%(fixtures.length>=1000?128:16)===0||finished===fixtures.length)console.log(JSON.stringify({completedFixtures:finished,totalFixtures:fixtures.length,engineResults:finished*arms.length}));
    if(finished===fixtures.length){resolve();return;}if(next<fixtures.length)worker.postMessage(fixtures[next++]);
   });
   if(next<fixtures.length)worker.postMessage(fixtures[next++]);
  }
 });
}finally{await Promise.all(pool.map(worker=>worker.terminate()));}
const fixtureOrder=new Map(fixtures.map((fixture,index)=>[fixture.id,index]));
records.sort((a,b)=>fixtureOrder.get(a.fixture.id)-fixtureOrder.get(b.fixture.id));
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
function pairedContrast(subset,caseId='confidence-5',referenceId='confidence-3') {
 const n=subset.length;const differences=subset.map(record=>record.arms.find(arm=>arm.id===caseId).focalWin-record.arms.find(arm=>arm.id===referenceId).focalWin);
 const delta=differences.reduce((s,x)=>s+x,0)/n;
 const variance=differences.reduce((s,x)=>s+(x-delta)**2,0)/Math.max(1,n-1),se=Math.sqrt(variance/n);
 const marginDifferences=subset.map(record=>{const a=record.arms.find(arm=>arm.id===caseId),b=record.arms.find(arm=>arm.id===referenceId);return(a.focalScore-a.opponentScore)-(b.focalScore-b.opponentScore);});
 const marginDelta=marginDifferences.reduce((s,x)=>s+x,0)/n;
 const marginSE=Math.sqrt(marginDifferences.reduce((s,x)=>s+(x-marginDelta)**2,0)/Math.max(1,n-1)/n);
 return{caseId,referenceId,matchedFixtures:n,winRateDifference:delta,standardError:se,approximate95:[Math.max(-1,delta-1.96*se),Math.min(1,delta+1.96*se)],improved:differences.filter(x=>x===1).length,worsened:differences.filter(x=>x===-1).length,unchanged:differences.filter(x=>x===0).length,meanScoreMarginDifference:marginDelta,scoreMarginDifference95:[marginDelta-1.96*marginSE,marginDelta+1.96*marginSE],intervalCaution:n<1000?'Exploratory small-sample approximation; do not use zero discordance as proof of no effect.':'Prespecified large-sample paired interval across independent matched fixture seeds.'};
}
const summary={schema:'century-streak-pilot-summary-v1',studyId,status:'completed',classification:'lab-only',sourceSHA256,
 experiment:manifest.experiment,armSet,runtime:manifest.runtime,analysisPlan:manifest.analysisPlan,primaryContrast:pairedContrast(records,psychological?'shared-full-5':'confidence-5',psychological?'control':'confidence-3'),profilePrimaryContrasts:profiles.map(profile=>({id:profile.id,...pairedContrast(records.filter(record=>record.fixture.profile===profile.id),psychological?'shared-full-5':'confidence-5',psychological?'control':'confidence-3')})),
 matchedFixtures:fixtures.length,engineResults:fixtures.length*arms.length,fullReplays:profiles.length*arms.length,frozenControls:profiles.length,resumedFixtures:resumed,
 coefficients,arms:summarize(records),profiles:profiles.map(profile=>({id:profile.id,arms:summarize(records.filter(r=>r.fixture.profile===profile.id))})),
 interpretation:manifest.interpretation,limitations:['Synthetic mirror-roster study, not a survey of actual club strengths or all possible roster/coach profiles.','Aggregate serious-foul model only; no explicit retaliation taxonomy.','Severity rates condition on observed foul opportunities; match trajectories and denominators can change.','Paired intervals are approximate; the conservative Wilson combination is the primary interval, especially with few discordant winners.','No player-rating changes, official writes, live weather calls, calibration acceptance or adoption.'],
 records};
const summaryFile=path.join(dir,'summary.json');
// Resumption is operational metadata; immutable sporting results and manifest remain fixed.
if(fs.existsSync(summaryFile)){const previous=readJSON(summaryFile);previous.resumedFixtures=resumed;assert.deepEqual(previous,summary);}else atomicJSON(summaryFile,summary,true);
console.log(JSON.stringify({status:'completed',studyId,matchedFixtures:summary.matchedFixtures,engineResults:summary.engineResults,output:summaryFile,arms:summary.arms},null,2));
