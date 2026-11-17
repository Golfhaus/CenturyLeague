import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {labRoot,hash,readJSON,atomicJSON,loadEngines,sourceFingerprint,verifyBaseline,verifyImportBoundary} from './tools.mjs';
import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from './runtime.mjs';
import {HEAT_ARMS} from './heat-fixtures.mjs';
const opts={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i];assert.ok(['--study-id','--trials','--workers','--profiles'].includes(k)&&process.argv[i+1]&&!opts[k]);opts[k]=process.argv[i+1];}
const studyId=opts['--study-id']??'copied-club-heat-validation-001';
assert.match(studyId,/^[a-z0-9][a-z0-9-]{0,79}$/);
const trials=Number(opts['--trials']??800),workers=Number(opts['--workers']??8);
assert.ok(Number.isSafeInteger(trials)&&trials>=2&&trials%2===0&&trials<=10000);
assert.ok(Number.isSafeInteger(workers)&&workers>=1&&workers<=8);
ensureQualifiedStudyProcess();const runtime=qualifyStudyRuntime(),baseline=verifyBaseline();verifyImportBoundary();
const e=await loadEngines(),sourceSHA256=sourceFingerprint(),profileBytes=fs.readFileSync(path.resolve(opts['--profiles']));
const copied=JSON.parse(profileBytes);assert.equal(copied.schema,'century-copied-club-profiles-v1');
const profiles=copied.profiles.filter(p=>/^pair-[1-4]-focal-0$/.test(p.id));
assert.equal(profiles.length,4);assert.equal(new Set(profiles.map(p=>p.pairId)).size,4);
for(const p of profiles){assert.equal(p.teams.length,2);for(const t of p.teams)assert.equal(t.players.length,35);}
const arms=HEAT_ARMS,matchDate='2026-11-14';
const fixtures=profiles.flatMap(p=>Array.from({length:trials},(_,trial)=>({id:`${studyId}-${p.id}-${trial}`,profile:p.id,trial,swap:Boolean(trial%2),seed:`century-heat-generalization:${studyId}:${p.id}:${trial}`})));
const manifest={schema:'century-heat-validation-v1',classification:'lab-only-not-adopted',studyId,runtime,sourceSHA256,baseline,
 matchDate,profiles,profilesSHA256:hash(JSON.stringify(profiles)),profileFileSHA256:hash(profileBytes),arms,fixtures,trialsPerProfile:trials,
 coefficients:{weather:e.WEATHER_CANDIDATE,thermalCandidates:e.THERMAL_MODERATION_CANDIDATES,traitsEnabled:false,psychologyEnabled:false},
 analysisPlan:{primary:'Four matchup-specific paired hot-minus-temperate score-margin effects; first club is focal. Bonferroni approximate 95% family intervals across four matchups.',
 winInterval:'Bonferroni/Wilson discordance bounds across four contrasts and eight marginal proportions.',
 samplePolicy:'Fixed fresh seeds, no pooling, tuning, replacement, outcome-dependent stopping or expansion.',
 protocolPath:'docs/HEAT_GENERALIZATION_PLAN_2026_11_14.md',protocolSHA256:hash(fs.readFileSync(path.join(labRoot,'../../docs/HEAT_GENERALIZATION_PLAN_2026_11_14.md'))),
 limits:'Selected copied rosters, original tactics, isolated heat at 35 C and 80% humidity. No global ceiling, causal tactic attribution, trait calibration or adoption.'},
 replayPolicy:'First two fixtures per matchup/arm fully replayed, temperate cells versus frozen v1.0; every saved result full replay on resume.'};
const dir=path.join(labRoot,'runs',studyId);fs.mkdirSync(dir,{recursive:true});
const mf=path.join(dir,'manifest.json');if(fs.existsSync(mf))assert.deepEqual(readJSON(mf),manifest);else atomicJSON(mf,manifest,true);
const records=[],pool=[];let next=0,resumedFixtures=0;
try{await new Promise((resolve,reject)=>{
 let finished=0,failed=false;const fail=e=>{if(!failed){failed=true;reject(e);}};
 for(let i=0;i<Math.min(workers,fixtures.length);i++){
  const w=new Worker(new URL('./heat-worker.mjs',import.meta.url),{workerData:{dir,profiles,requiredExecArgv:runtime.workerExecArgv}});pool.push(w);
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
const summary={schema:'century-heat-validation-summary-v1',status:'completed',studyId,sourceSHA256,matchedFixtures:fixtures.length,engineResults:fixtures.length*arms.length,resumedFixtures,fullReplays:2*profiles.length*arms.length,frozenControls:2*profiles.length,records};
const sf=path.join(dir,'summary.json');if(fs.existsSync(sf)){const previous=readJSON(sf);previous.resumedFixtures=resumedFixtures;assert.deepEqual(previous,summary);}else atomicJSON(sf,summary,true);
console.log(JSON.stringify({status:'completed',studyId,matchedFixtures:fixtures.length,engineResults:summary.engineResults}));
