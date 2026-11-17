import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {labRoot,hash,readJSON,atomicJSON,loadEngines,sourceFingerprint,verifyBaseline,verifyImportBoundary} from './tools.mjs';
import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from './runtime.mjs';
import {stageArms} from './modifier-stage-fixtures.mjs';
const opts={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i];assert.ok(['--stage','--study-id','--trials','--workers','--profiles','--gate'].includes(k)&&process.argv[i+1]&&!opts[k]);opts[k]=process.argv[i+1];}
const stage=opts['--stage'];assert.ok(['cold-confirmation','combined'].includes(stage));
const studyId=opts['--study-id']??(stage==='cold-confirmation'?'cold-adverse-confirmation-001':'copied-club-combined-modifiers-001');
assert.match(studyId,/^[a-z0-9][a-z0-9-]{0,79}$/);
const trials=Number(opts['--trials']??(stage==='cold-confirmation'?2560:256)),workers=Number(opts['--workers']??8);
assert.ok(Number.isSafeInteger(trials)&&trials>=2&&trials%2===0&&trials<=10000);
assert.ok(Number.isSafeInteger(workers)&&workers>=1&&workers<=8);
ensureQualifiedStudyProcess();const runtime=qualifyStudyRuntime(),baseline=verifyBaseline();verifyImportBoundary();
const e=await loadEngines(),sourceSHA256=sourceFingerprint(),profileBytes=fs.readFileSync(path.resolve(opts['--profiles']));
const copied=JSON.parse(profileBytes);assert.equal(copied.schema,'century-copied-club-profiles-v1');
const profiles=copied.profiles.filter(p=>/^pair-[1-4]-focal-0$/.test(p.id));
assert.equal(profiles.length,4);assert.equal(new Set(profiles.map(p=>p.pairId)).size,4);
for(const p of profiles){assert.equal(p.teams.length,2);for(const t of p.teams)assert.equal(t.players.length,35);}
const arms=stageArms(stage),matchDate='2026-11-14';
const fixtures=profiles.flatMap(p=>Array.from({length:trials},(_,trial)=>({id:`${studyId}-${p.id}-${trial}`,profile:p.id,trial,swap:Boolean(trial%2),seed:`century-modifier-stage:${stage}:${studyId}:${p.id}:${trial}`})));
let gate=null;
if(stage==='combined'){
 assert.ok(opts['--gate'],'Combined stage requires a confirmed cold gate');gate=readJSON(path.resolve(opts['--gate']));
 assert.equal(gate.confirmed,true,'Cold confirmation condition not met');assert.equal(gate.sourceSHA256,sourceSHA256,'Gate source differs');
 if(gate.testOnly)assert.ok(studyId.startsWith('modifier-preflight-'),'Test gate cannot authorize research');else assert.equal(gate.studyId,'cold-adverse-confirmation-001');
}
const manifest={schema:'century-modifier-stage-v1',classification:'lab-only-not-adopted',studyId,stage,runtime,sourceSHA256,baseline,
 matchDate,gate,profiles,profilesSHA256:hash(JSON.stringify(profiles)),profileFileSHA256:hash(profileBytes),arms,fixtures,trialsPerProfile:trials,
 coefficients:{weather:e.WEATHER_CANDIDATE,thermalCandidates:e.THERMAL_MODERATION_CANDIDATES,traitsPolicy:'opposed-extreme-traits-035',psychologyPolicy:{confidenceScale:.2,homeOddsBonus:.004,maximumOddsBonus:.006,frustrationScale:1},stage},
 analysisPlan:{primary:stage==='cold-confirmation'?'Paired pooled adverse 0.35 minus same-weather mean tolerance, conservative paired discordance interval.':'Four combined corners versus neutral, family-protected paired discordance intervals across four comparisons.',
 samplePolicy:'Fixed fresh sample; no historical pooling, tuning, replacement, outcome-driven stopping or expansion.',
 protocolPath:'docs/COLD_CONFIRMATION_AND_COMBINED_PLAN_2026_11_14.md',protocolSHA256:hash(fs.readFileSync(path.join(labRoot,'../../docs/COLD_CONFIRMATION_AND_COMBINED_PLAN_2026_11_14.md'))),
 limits:'Selected copied pairings and specified corners, no global ceiling, halftime adaptation, season validation or adoption.'},
 replayPolicy:stage==='combined'?'First two fixtures per matchup/arm fully replayed; neutral control versus frozen v1.0; saved results fully replay on resume.':'First two fixtures per matchup/arm fully replayed; no temperate research arm; neutral parity qualified in preflight; saved results fully replay on resume.'};
const dir=path.join(labRoot,'runs',studyId);fs.mkdirSync(dir,{recursive:true});
const mf=path.join(dir,'manifest.json');if(fs.existsSync(mf))assert.deepEqual(readJSON(mf),manifest);else atomicJSON(mf,manifest,true);
const records=[],pool=[];let next=0,resumedFixtures=0;
try{await new Promise((resolve,reject)=>{
 let finished=0,failed=false;const fail=e=>{if(!failed){failed=true;reject(e);}};
 for(let i=0;i<Math.min(workers,fixtures.length);i++){
  const w=new Worker(new URL('./modifier-stage-worker.mjs',import.meta.url),{workerData:{dir,profiles,stage,requiredExecArgv:runtime.workerExecArgv}});pool.push(w);
  w.on('error',fail);w.on('exit',code=>{if(!failed&&finished<fixtures.length)fail(Error(`Worker exited ${code} before the study completed`));});
  w.on('message',msg=>{if(failed)return;if(msg.error){fail(Error(msg.fixtureId+': '+msg.error));return;}
   records.push(msg.record);resumedFixtures+=Number(msg.resumed);finished++;
   if(finished%32===0||finished===fixtures.length)console.log(JSON.stringify({completedFixtures:finished,totalFixtures:fixtures.length,engineResults:finished*arms.length}));
   if(finished===fixtures.length)resolve();else if(next<fixtures.length)w.postMessage(fixtures[next++]);
  });if(next<fixtures.length)w.postMessage(fixtures[next++]);
 }
});}finally{await Promise.all(pool.map(w=>w.terminate()));}
const order=new Map(fixtures.map((f,i)=>[f.id,i]));records.sort((a,b)=>order.get(a.fixture.id)-order.get(b.fixture.id));
verifyBaseline();verifyImportBoundary();assert.equal(sourceFingerprint(),sourceSHA256,'Source changed during study');
const summary={schema:'century-modifier-stage-summary-v1',status:'completed',studyId,stage,sourceSHA256,matchedFixtures:fixtures.length,engineResults:fixtures.length*arms.length,resumedFixtures,fullReplays:2*profiles.length*arms.length,frozenControls:stage==='combined'?2*profiles.length:0,records};
const sf=path.join(dir,'summary.json');if(fs.existsSync(sf)){const previous=readJSON(sf);previous.resumedFixtures=resumedFixtures;assert.deepEqual(previous,summary);}else atomicJSON(sf,summary,true);
console.log(JSON.stringify({status:'completed',studyId,matchedFixtures:fixtures.length,engineResults:summary.engineResults}));
