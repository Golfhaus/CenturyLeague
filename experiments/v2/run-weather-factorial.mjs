import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{Worker}from'node:worker_threads';
import{labRoot,hash,readJSON,atomicJSON,loadEngines,sourceFingerprint,verifyBaseline,verifyImportBoundary}from'./tools.mjs';
import{ensureQualifiedStudyProcess,qualifyStudyRuntime}from'./runtime.mjs';import{FACTORIAL_ARMS,FACTORIAL_POLICY}from'./factorial-fixtures.mjs';
const opts={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i];assert.ok(['--study-id','--trials','--workers','--profiles'].includes(k)&&process.argv[i+1]&&!opts[k]);opts[k]=process.argv[i+1];}
const studyId=opts['--study-id']??'philadelphia-norfolk-weather-factorial-001',trials=Number(opts['--trials']??800),workers=Number(opts['--workers']??8);
assert.match(studyId,/^[a-z0-9][a-z0-9-]{0,79}$/);assert.ok(Number.isSafeInteger(trials)&&trials>=2&&trials%2===0&&trials<=10000);assert.ok(Number.isSafeInteger(workers)&&workers>=1&&workers<=8);
ensureQualifiedStudyProcess();const runtime=qualifyStudyRuntime(),baseline=verifyBaseline();verifyImportBoundary();const e=await loadEngines(),sourceSHA256=sourceFingerprint();
const bytes=fs.readFileSync(path.resolve(opts['--profiles'])),copied=JSON.parse(bytes);assert.equal(copied.schema,'century-copied-club-profiles-v1');
const profile=copied.profiles.find(p=>p.id==='pair-3-focal-1');assert.ok(profile);assert.equal(profile.teams.length,2);for(const t of profile.teams)assert.equal(t.players.length,35);
assert.deepEqual(Object.fromEntries(Object.keys(FACTORIAL_POLICY.matched).map(k=>[k,profile.teams[0].coach.tactics[k]])),{tempo:5,running_movement_emphasis:5,pressure:3});
assert.deepEqual(Object.fromEntries(Object.keys(FACTORIAL_POLICY.matched).map(k=>[k,profile.teams[1].coach.tactics[k]])),FACTORIAL_POLICY.matched);
const fixtures=Array.from({length:trials},(_,trial)=>({id:`${studyId}-${trial}`,profile:profile.id,trial,swap:Boolean(trial%2),seed:`century-weather-factorial:${studyId}:${trial}`}));
const manifest={schema:'century-weather-factorial-v1',classification:'lab-only-not-adopted',studyId,runtime,sourceSHA256,baseline,matchDate:'2026-11-13',
 profile,profileSHA256:hash(JSON.stringify(profile)),profileFileSHA256:hash(bytes),arms:FACTORIAL_ARMS,policy:FACTORIAL_POLICY,fixtures,trials,
 coefficients:{weather:e.WEATHER_CANDIDATE,thermalCandidates:e.THERMAL_MODERATION_CANDIDATES,psychology:{enabled:[],confidenceScale:.2,frustrationScale:1,homeOddsBonus:.004,maximumOddsBonus:.006}},
 analysisPlan:{primary:'Mean score-margin interaction: matched(full)-matched(neutral)-original(full)+original(neutral). Positive means matched pace/workload weakens Philadelphia weather disadvantage.',
 primaryInterval:'Fixture-cluster paired mean +/- 1.96 sample standard error, large-sample nominal 95%.',
 secondary:'Win-rate interaction; direct corner effects; signed Shapley allocations; averaged factorial main, pair and triple effects; simulation sides; energy, execution and pace. Per-contrast nominal intervals, not simultaneous.',
 shapley:'Average marginal changes across six component orders: 1/3, 1/6, 1/6, 1/3. Declared allocation of interactions, not unique physical attribution.',
 samplePolicy:'Fixed complete sample, fresh matched seeds, no pooling, tuning, replacement, outcome-dependent stopping or expansion.',
 tacticalScope:'Only Philadelphia tempo, running emphasis and pressure are jointly matched to Norfolk; other tactics and ratings unchanged. No individual tactic attribution.',
 limits:'Selected matchup, one severe level per component, inactive psychology and mean tolerance, fixed healthy availability. Model mechanism study, not empirical physiological calibration or adoption.'},
 replayPolicy:'First two fixtures every arm fully replayed; neutral cells versus frozen v1.0 in each context. Every saved result fully replays on resumption.'};
const dir=path.join(labRoot,'runs',studyId);fs.mkdirSync(dir,{recursive:true});const mf=path.join(dir,'manifest.json');if(fs.existsSync(mf))assert.deepEqual(readJSON(mf),manifest);else atomicJSON(mf,manifest,true);
const records=[],pool=[];let next=0,resumedFixtures=0;
try{await new Promise((resolve,reject)=>{let finished=0,failed=false;const fail=e=>{if(!failed){failed=true;reject(e);}};
 for(let i=0;i<Math.min(workers,fixtures.length);i++){
  const w=new Worker(new URL('./factorial-worker.mjs',import.meta.url),{workerData:{dir,profile,requiredExecArgv:runtime.workerExecArgv}});pool.push(w);
  w.on('error',fail);w.on('exit',code=>{if(!failed&&finished<fixtures.length)fail(Error('Worker exited '+code+' before the study completed'));});
  w.on('message',m=>{if(failed)return;if(m.error){fail(Error(m.fixtureId+': '+m.error));return;}records.push(m.record);resumedFixtures+=Number(m.resumed);finished++;
   if(finished%16===0||finished===fixtures.length)console.log(JSON.stringify({completedFixtures:finished,totalFixtures:fixtures.length,engineResults:finished*16}));
   if(finished===fixtures.length)resolve();else if(next<fixtures.length)w.postMessage(fixtures[next++]);
  });if(next<fixtures.length)w.postMessage(fixtures[next++]);
 }
});}finally{await Promise.all(pool.map(w=>w.terminate()));}
records.sort((a,b)=>a.fixture.trial-b.fixture.trial);verifyBaseline();verifyImportBoundary();assert.equal(sourceFingerprint(),sourceSHA256,'Source changed during study');
const summary={schema:'century-weather-factorial-summary-v1',status:'completed',studyId,sourceSHA256,matchedFixtures:trials,engineResults:trials*16,resumedFixtures,fullReplays:32,frozenNeutralControls:4,records};
const sf=path.join(dir,'summary.json');if(fs.existsSync(sf)){const previous=readJSON(sf);previous.resumedFixtures=resumedFixtures;assert.deepEqual(previous,summary);}else atomicJSON(sf,summary,true);
console.log(JSON.stringify({status:'completed',studyId,matchedFixtures:trials,engineResults:trials*16}));
