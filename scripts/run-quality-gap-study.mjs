import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {labRoot,hash,readJSON,atomicJSON,loadEngines,sourceFingerprint,verifyBaseline,verifyImportBoundary} from '../experiments/v2/tools.mjs';
import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from '../experiments/v2/runtime.mjs';
import {qualityArms,qualityHarnessFingerprint,verifyBreadth,readSelection} from './quality-gap-spec.mjs';
const opts={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i];assert.ok(['--stage','--study-id','--trials','--workers','--profiles','--screen-dir','--selection'].includes(k)&&process.argv[i+1]&&!opts[k]);opts[k]=process.argv[i+1];}
const stage=opts['--stage'];assert.ok(['controls','modifiers'].includes(stage));
const studyId=opts['--study-id']??(stage==='controls'?'quality-control-ladder-001':'moderate-quality-modifier-validation-001');
assert.match(studyId,/^[a-z0-9][a-z0-9-]{0,79}$/);
const trials=Number(opts['--trials']??(stage==='controls'?64:96)),workers=Number(opts['--workers']??8);
assert.ok(Number.isSafeInteger(trials)&&trials>=2&&trials%2===0&&trials<=10000);
assert.ok(Number.isSafeInteger(workers)&&workers>=1&&workers<=8);
assert.ok(studyId.startsWith('quality-preflight-')?trials===6:(stage==='controls'?studyId==='quality-control-ladder-001'&&trials===64:studyId==='moderate-quality-modifier-validation-001'&&trials===96),'Fixed quality protocol required');
ensureQualifiedStudyProcess();const runtime=qualifyStudyRuntime(),baseline=verifyBaseline();verifyImportBoundary();
const e=await loadEngines(),sourceSHA256=sourceFingerprint(),profileBytes=fs.readFileSync(path.resolve(opts['--profiles']));
const copied=JSON.parse(profileBytes);assert.equal(copied.schema,'century-quality-gap-profiles-v1');
const harnessSHA256=qualityHarnessFingerprint();let selection=null,profiles=copied.profiles;
if(stage==='modifiers'){assert.ok(opts['--selection']);selection=readSelection(opts['--selection'],studyId,sourceSHA256,harnessSHA256);profiles=profiles.filter(p=>[0,selection.selectedMagnitude,-selection.selectedMagnitude].includes(p.gap));}
if(studyId.startsWith('quality-preflight-'))profiles=profiles.filter(p=>p.replicate===1&&[0,.1,-.1].includes(p.gap));
assert.equal(profiles.length,studyId.startsWith('quality-preflight-')?6:stage==='controls'?88:24);
for(const p of profiles){assert.equal(p.teams.length,2);for(const t of p.teams)assert.equal(t.players.length,35);}
const arms=qualityArms(stage),matchDate='2026-11-15';
const fixtures=profiles.flatMap(p=>Array.from({length:trials},(_,trial)=>({id:`${studyId}-${p.id}-${trial}`,profile:p.id,trial,swap:Boolean(trial%2),seed:`century-modifier-stage:${stage}:${studyId}:${p.id}:${trial}`})));
const priorStudy=verifyBreadth(opts['--screen-dir'],sourceSHA256);
const manifest={schema:'century-quality-gap-study-v1',harnessSHA256,classification:'lab-only-not-adopted',selection,priorStudy,studyId,stage,runtime,sourceSHA256,baseline,
 matchDate,profiles,profilesSHA256:hash(JSON.stringify(profiles)),profileFileSHA256:hash(profileBytes),arms,fixtures,trialsPerProfile:trials,
 coefficients:{weather:e.WEATHER_CANDIDATE,thermalCandidates:e.THERMAL_MODERATION_CANDIDATES,traitsPolicy:'fixed-player-ID-normal-ordinary;opposed-extreme-035-peak',psychologyPolicy:{confidenceScale:.2,homeOddsBonus:.004,maximumOddsBonus:.006,frustrationScale:1},stage},
 analysisPlan:{primary:'Controls select a moderate rating gap using predefined guards; independent modifier follow-up has separate ordinary family6, psychology family6 and extreme family12 across three quality strata.',
 samplePolicy:'Fixed fresh sample; no historical pooling, tuning, replacement, outcome-driven stopping or expansion.',
 protocolPath:'docs/QUALITY_GAP_LADDER_AND_VALIDATION_PLAN_2026_11_15.md',protocolSHA256:hash(fs.readFileSync(path.join(labRoot,'../../docs/QUALITY_GAP_LADDER_AND_VALIDATION_PLAN_2026_11_15.md'))),
 limits:'New synthetic mirrored quality templates and explicit opponent rating offsets; controls select fixtures only, modifier follow-up uses fresh seeds; no league-average or global ceiling, official players, halftime, season carryover or adoption.'},
 replayPolicy:'First two fixtures per profile/arm fully replay; neutral controls versus frozen v1.0; all saved results replay on explicit resume.'};
const dir=path.join(labRoot,'runs',studyId);fs.mkdirSync(dir,{recursive:true});
const mf=path.join(dir,'manifest.json');if(fs.existsSync(mf))assert.deepEqual(readJSON(mf),manifest);else atomicJSON(mf,manifest,true);
const records=[],pool=[];let next=0,resumedFixtures=0;
try{await new Promise((resolve,reject)=>{
 let finished=0,failed=false;const fail=e=>{if(!failed){failed=true;reject(e);}};
 for(let i=0;i<Math.min(workers,fixtures.length);i++){
  const w=new Worker(new URL('./quality-gap-worker.mjs',import.meta.url),{workerData:{dir,profiles,stage,requiredExecArgv:runtime.workerExecArgv}});pool.push(w);
  w.on('error',fail);w.on('exit',code=>{if(!failed&&finished<fixtures.length)fail(Error(`Worker exited ${code} before the study completed`));});
  w.on('message',msg=>{if(failed)return;if(msg.error){fail(Error(msg.fixtureId+': '+msg.error));return;}
   records.push(msg.record);resumedFixtures+=Number(msg.resumed);finished++;
   if(finished%32===0||finished===fixtures.length)console.log(JSON.stringify({completedFixtures:finished,totalFixtures:fixtures.length,engineResults:finished*arms.length}));
   if(finished===fixtures.length)resolve();else if(next<fixtures.length)w.postMessage(fixtures[next++]);
  });if(next<fixtures.length)w.postMessage(fixtures[next++]);
 }
});}finally{await Promise.all(pool.map(w=>w.terminate()));}
const order=new Map(fixtures.map((f,i)=>[f.id,i]));records.sort((a,b)=>order.get(a.fixture.id)-order.get(b.fixture.id));
verifyBaseline();verifyImportBoundary();assert.equal(sourceFingerprint(),sourceSHA256,'Source changed during study');assert.equal(qualityHarnessFingerprint(),harnessSHA256,'Confirmation harness changed during study');
const summary={schema:'century-quality-gap-study-summary-v1',harnessSHA256,status:'completed',studyId,stage,sourceSHA256,matchedFixtures:fixtures.length,engineResults:fixtures.length*arms.length,resumedFixtures,fullReplays:2*profiles.length*arms.length,frozenControls:2*profiles.length,records};
const sf=path.join(dir,'summary.json');if(fs.existsSync(sf)){const previous=readJSON(sf);previous.resumedFixtures=resumedFixtures;assert.deepEqual(previous,summary);}else atomicJSON(sf,summary,true);
console.log(JSON.stringify({status:'completed',studyId,matchedFixtures:fixtures.length,engineResults:summary.engineResults,resumedFixtures}));
