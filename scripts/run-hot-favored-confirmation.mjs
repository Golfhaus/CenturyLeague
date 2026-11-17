import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {labRoot,hash,readJSON,atomicJSON,loadEngines,sourceFingerprint,verifyBaseline,verifyImportBoundary} from '../experiments/v2/tools.mjs';
import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from '../experiments/v2/runtime.mjs';
import {HOT_ARMS,hotHarnessFingerprint,verifyScreen} from './hot-favored-confirmation-spec.mjs';
const opts={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i];assert.ok(['--study-id','--trials','--workers','--profiles','--gate','--screen-dir'].includes(k)&&process.argv[i+1]&&!opts[k]);opts[k]=process.argv[i+1];}
const stage='hot-favored-confirmation';
const studyId=opts['--study-id']??'hot-favored-combined-confirmation-001';
assert.match(studyId,/^[a-z0-9][a-z0-9-]{0,79}$/);
const trials=Number(opts['--trials']??2560),workers=Number(opts['--workers']??8);
assert.ok(Number.isSafeInteger(trials)&&trials>=2&&trials%2===0&&trials<=10000);
assert.ok(Number.isSafeInteger(workers)&&workers>=1&&workers<=8);
assert.ok(studyId.startsWith('hot-confirmation-preflight-')?trials===4:studyId==='hot-favored-combined-confirmation-001'&&trials===2560,'Research sample must match fixed protocol');
ensureQualifiedStudyProcess();const runtime=qualifyStudyRuntime(),baseline=verifyBaseline();verifyImportBoundary();
const e=await loadEngines(),sourceSHA256=sourceFingerprint(),profileBytes=fs.readFileSync(path.resolve(opts['--profiles']));
const copied=JSON.parse(profileBytes);assert.equal(copied.schema,'century-copied-club-profiles-v1');
const profiles=copied.profiles.filter(p=>/^pair-[1-4]-focal-0$/.test(p.id));
assert.equal(profiles.length,4);assert.equal(new Set(profiles.map(p=>p.pairId)).size,4);
for(const p of profiles){assert.equal(p.teams.length,2);for(const t of p.teams)assert.equal(t.players.length,35);}
const arms=HOT_ARMS,matchDate='2026-11-14';
const fixtures=profiles.flatMap(p=>Array.from({length:trials},(_,trial)=>({id:`${studyId}-${p.id}-${trial}`,profile:p.id,trial,swap:Boolean(trial%2),seed:`century-modifier-stage:${stage}:${studyId}:${p.id}:${trial}`})));
let gate=null;
{
 assert.ok(opts['--gate'],'Combined stage requires a confirmed cold gate');gate=readJSON(path.resolve(opts['--gate']));
 assert.equal(gate.confirmed,true,'Cold confirmation condition not met');assert.equal(gate.sourceSHA256,sourceSHA256,'Gate source differs');
 if(gate.testOnly)assert.ok(studyId.startsWith('hot-confirmation-preflight-'),'Test gate cannot authorize research');else assert.equal(gate.studyId,'cold-adverse-confirmation-001');
}
const harnessSHA256=hotHarnessFingerprint(),priorStudy=verifyScreen(opts['--screen-dir'],sourceSHA256,hash(JSON.stringify(profiles))); 
const manifest={schema:'century-hot-favored-confirmation-v1',harnessSHA256,classification:'lab-only-not-adopted',priorStudy,studyId,stage,runtime,sourceSHA256,baseline,
 matchDate,gate,profiles,profilesSHA256:hash(JSON.stringify(profiles)),profileFileSHA256:hash(profileBytes),arms,fixtures,trialsPerProfile:trials,
 coefficients:{weather:e.WEATHER_CANDIDATE,thermalCandidates:e.THERMAL_MODERATION_CANDIDATES,traitsPolicy:'opposed-extreme-traits-035',psychologyPolicy:{confidenceScale:.2,homeOddsBonus:.004,maximumOddsBonus:.006,frustrationScale:1},stage},
 analysisPlan:{primary:'Single paired pooled hot-favored-combined minus control; conservative discordance interval; assess +10 and +15 point references separately.',
 samplePolicy:'Fixed fresh sample; no historical pooling, tuning, replacement, outcome-driven stopping or expansion.',
 protocolPath:'docs/HOT_FAVORED_COMBINED_CONFIRMATION_PLAN_2026_11_15.md',protocolSHA256:hash(fs.readFileSync(path.join(labRoot,'../../docs/HOT_FAVORED_COMBINED_CONFIRMATION_PLAN_2026_11_15.md'))),
 limits:'Selected copied pairings and specified corners, no global ceiling, halftime adaptation, season validation or adoption.'},
 replayPolicy:'First two fixtures per profile/arm fully replay; neutral controls versus frozen v1.0; all saved results replay on explicit resume.'};
const dir=path.join(labRoot,'runs',studyId);fs.mkdirSync(dir,{recursive:true});
const mf=path.join(dir,'manifest.json');if(fs.existsSync(mf))assert.deepEqual(readJSON(mf),manifest);else atomicJSON(mf,manifest,true);
const records=[],pool=[];let next=0,resumedFixtures=0;
try{await new Promise((resolve,reject)=>{
 let finished=0,failed=false;const fail=e=>{if(!failed){failed=true;reject(e);}};
 for(let i=0;i<Math.min(workers,fixtures.length);i++){
  const w=new Worker(new URL('./hot-favored-confirmation-worker.mjs',import.meta.url),{workerData:{dir,profiles,stage,requiredExecArgv:runtime.workerExecArgv}});pool.push(w);
  w.on('error',fail);w.on('exit',code=>{if(!failed&&finished<fixtures.length)fail(Error(`Worker exited ${code} before the study completed`));});
  w.on('message',msg=>{if(failed)return;if(msg.error){fail(Error(msg.fixtureId+': '+msg.error));return;}
   records.push(msg.record);resumedFixtures+=Number(msg.resumed);finished++;
   if(finished%32===0||finished===fixtures.length)console.log(JSON.stringify({completedFixtures:finished,totalFixtures:fixtures.length,engineResults:finished*arms.length}));
   if(finished===fixtures.length)resolve();else if(next<fixtures.length)w.postMessage(fixtures[next++]);
  });if(next<fixtures.length)w.postMessage(fixtures[next++]);
 }
});}finally{await Promise.all(pool.map(w=>w.terminate()));}
const order=new Map(fixtures.map((f,i)=>[f.id,i]));records.sort((a,b)=>order.get(a.fixture.id)-order.get(b.fixture.id));
verifyBaseline();verifyImportBoundary();assert.equal(sourceFingerprint(),sourceSHA256,'Source changed during study');assert.equal(hotHarnessFingerprint(),harnessSHA256,'Confirmation harness changed during study');
const summary={schema:'century-hot-favored-confirmation-summary-v1',harnessSHA256,status:'completed',studyId,stage,sourceSHA256,matchedFixtures:fixtures.length,engineResults:fixtures.length*arms.length,resumedFixtures,fullReplays:2*profiles.length*arms.length,frozenControls:2*profiles.length,records};
const sf=path.join(dir,'summary.json');if(fs.existsSync(sf)){const previous=readJSON(sf);previous.resumedFixtures=resumedFixtures;assert.deepEqual(previous,summary);}else atomicJSON(sf,summary,true);
console.log(JSON.stringify({status:'completed',studyId,matchedFixtures:fixtures.length,engineResults:summary.engineResults,resumedFixtures}));
