import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {labRoot,hash,readJSON,atomicJSON,loadEngines,sourceFingerprint,verifyBaseline,verifyImportBoundary} from '../experiments/v2/tools.mjs';
import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from '../experiments/v2/runtime.mjs';
import {adverseArms,adverseHarnessFingerprint,verifyAdverseScreen} from './adverse-confirmation-spec.mjs';
const opts={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i];assert.ok(['--cohort','--study-id','--trials','--workers','--profiles','--screen-dir'].includes(k)&&process.argv[i+1]&&!opts[k]);opts[k]=process.argv[i+1];}
const stage=opts['--cohort'];assert.ok(['matched','stronger'].includes(stage));
const studyId=opts['--study-id']??`adverse-${stage}-confirmation-001`;
assert.match(studyId,/^[a-z0-9][a-z0-9-]{0,79}$/);
const trials=Number(opts['--trials']??512),workers=Number(opts['--workers']??8);
assert.ok(Number.isSafeInteger(trials)&&trials>=2&&trials%2===0&&trials<=10000);
assert.ok(Number.isSafeInteger(workers)&&workers>=1&&workers<=8);
assert.ok(studyId.startsWith(`adverse-preflight-${stage}-`)?trials===6:studyId===`adverse-${stage}-confirmation-001`&&trials===512,'Fixed adverse protocol required');
ensureQualifiedStudyProcess();const runtime=qualifyStudyRuntime(),baseline=verifyBaseline();verifyImportBoundary();
const e=await loadEngines(),sourceSHA256=sourceFingerprint(),profileBytes=fs.readFileSync(path.resolve(opts['--profiles']));
const copied=JSON.parse(profileBytes);assert.equal(copied.schema,'century-quality-gap-profiles-v1');
const harnessSHA256=adverseHarnessFingerprint(),priorStudy=verifyAdverseScreen(opts['--screen-dir'],sourceSHA256,profileBytes);let profiles=copied.profiles.filter(p=>p.gap===(stage==='matched'?0:-.1));
if(studyId.startsWith('adverse-preflight-'))profiles=profiles.filter(p=>p.replicate===1);
assert.equal(profiles.length,studyId.startsWith('adverse-preflight-')?2:8);
for(const p of profiles){assert.equal(p.teams.length,2);for(const t of p.teams)assert.equal(t.players.length,35);}
const arms=adverseArms(stage),matchDate='2026-11-15';
const fixtures=profiles.flatMap(p=>Array.from({length:trials},(_,trial)=>({id:`${studyId}-${p.id}-${trial}`,profile:p.id,trial,swap:Boolean(trial%2),seed:`century-adverse-confirmation:${stage}:${studyId}:${p.id}:${trial}`})));
const manifest={schema:'century-adverse-confirmation-v1',harnessSHA256,classification:'lab-only-not-adopted',priorStudy,studyId,stage,runtime,sourceSHA256,baseline,
 matchDate,profiles,profilesSHA256:hash(JSON.stringify(profiles)),profileFileSHA256:hash(profileBytes),arms,fixtures,trialsPerProfile:trials,
 coefficients:{weather:e.WEATHER_CANDIDATE,thermalCandidates:e.THERMAL_MODERATION_CANDIDATES,traitsPolicy:'fixed-player-ID-normal-ordinary;opposed-extreme-035-peak',psychologyPolicy:{confidenceScale:.2,homeOddsBonus:.004,maximumOddsBonus:.006,frustrationScale:1},stage},
 analysisPlan:{primary:'One family3: matched hot-adverse, matched psych-adverse, stronger psych-adverse; no old outcome pooling.',baselineFamilySize:2,primaryFamilySize:3,protocolPath:'docs/ADVERSE_MODIFIER_CONFIRMATION_PLAN_2026_11_16.md',protocolSHA256:hash(fs.readFileSync(path.join(labRoot,'../../docs/ADVERSE_MODIFIER_CONFIRMATION_PLAN_2026_11_16.md'))),limits:'Fixed selected synthetic contexts, fresh seeds; no league-wide ceiling, tuning, halftime, season validation or adoption.'},
 replayPolicy:'First two fixtures per profile/arm fully replay; neutral controls versus frozen v1.0; all saved results replay on explicit resume.'};
const dir=path.join(labRoot,'runs',studyId);fs.mkdirSync(dir,{recursive:true});
const mf=path.join(dir,'manifest.json');if(fs.existsSync(mf))assert.deepEqual(readJSON(mf),manifest);else atomicJSON(mf,manifest,true);
const records=[],pool=[];let next=0,resumedFixtures=0;
try{await new Promise((resolve,reject)=>{
 let finished=0,failed=false;const fail=e=>{if(!failed){failed=true;reject(e);}};
 for(let i=0;i<Math.min(workers,fixtures.length);i++){
  const w=new Worker(new URL('./adverse-confirmation-worker.mjs',import.meta.url),{workerData:{dir,profiles,stage,requiredExecArgv:runtime.workerExecArgv}});pool.push(w);
  w.on('error',fail);w.on('exit',code=>{if(!failed&&finished<fixtures.length)fail(Error(`Worker exited ${code} before the study completed`));});
  w.on('message',msg=>{if(failed)return;if(msg.error){fail(Error(msg.fixtureId+': '+msg.error));return;}
   records.push(msg.record);resumedFixtures+=Number(msg.resumed);finished++;
   if(finished%32===0||finished===fixtures.length)console.log(JSON.stringify({completedFixtures:finished,totalFixtures:fixtures.length,engineResults:finished*arms.length}));
   if(finished===fixtures.length)resolve();else if(next<fixtures.length)w.postMessage(fixtures[next++]);
  });if(next<fixtures.length)w.postMessage(fixtures[next++]);
 }
});}finally{await Promise.all(pool.map(w=>w.terminate()));}
const order=new Map(fixtures.map((f,i)=>[f.id,i]));records.sort((a,b)=>order.get(a.fixture.id)-order.get(b.fixture.id));
verifyBaseline();verifyImportBoundary();assert.equal(sourceFingerprint(),sourceSHA256,'Source changed during study');assert.equal(adverseHarnessFingerprint(),harnessSHA256,'Confirmation harness changed during study');
const summary={schema:'century-adverse-confirmation-summary-v1',harnessSHA256,status:'completed',studyId,stage,sourceSHA256,matchedFixtures:fixtures.length,engineResults:fixtures.length*arms.length,resumedFixtures,fullReplays:2*profiles.length*arms.length,frozenControls:2*profiles.length,records};
const sf=path.join(dir,'summary.json');if(fs.existsSync(sf)){const previous=readJSON(sf);previous.resumedFixtures=resumedFixtures;assert.deepEqual(previous,summary);}else atomicJSON(sf,summary,true);
console.log(JSON.stringify({status:'completed',studyId,matchedFixtures:fixtures.length,engineResults:summary.engineResults,resumedFixtures}));
