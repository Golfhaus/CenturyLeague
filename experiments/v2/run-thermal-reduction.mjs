import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {labRoot,hash,readJSON,atomicJSON,loadEngines,sourceFingerprint,verifyBaseline,verifyImportBoundary} from './tools.mjs';
import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from './runtime.mjs';
import {WEATHER_ARMS,FIXED_WEATHER} from './weather-fixtures.mjs';
const opts={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i];assert.ok(['--cohort','--study-id','--trials','--workers','--profiles'].includes(k)&&process.argv[i+1]&&!opts[k]);opts[k]=process.argv[i+1];}
const cohort=opts['--cohort'];assert.ok(['main','targeted'].includes(cohort));
const studyId=opts['--study-id']??(cohort==='main'?'thermal-reduction-screen-001':'philadelphia-norfolk-weather-recheck-001');
assert.match(studyId,/^[a-z0-9][a-z0-9-]{0,79}$/);
const trials=Number(opts['--trials']??(cohort==='main'?200:800)),workers=Number(opts['--workers']??8);
assert.ok(Number.isSafeInteger(trials)&&trials>=2&&trials%2===0&&trials<=10000);
assert.ok(Number.isSafeInteger(workers)&&workers>=1&&workers<=8);
ensureQualifiedStudyProcess();const runtime=qualifyStudyRuntime(),baseline=verifyBaseline();verifyImportBoundary();
const e=await loadEngines(),sourceSHA256=sourceFingerprint(),profileBytes=fs.readFileSync(path.resolve(opts['--profiles']));
const copied=JSON.parse(profileBytes);assert.equal(copied.schema,'century-copied-club-profiles-v1');
const profiles=cohort==='main'?copied.profiles:copied.profiles.filter(p=>p.id==='pair-3-focal-1');
assert.equal(profiles.length,cohort==='main'?8:1);
for(const p of profiles){assert.equal(p.teams.length,2);for(const t of p.teams)assert.equal(t.players.length,35);}
const originalIds=['control','hot-wet-shared','hot-wet-traits-favored','hot-wet-traits-adverse','hot-psych-favored','hot-psych-adverse'];
const originals=WEATHER_ARMS.filter(a=>originalIds.includes(a.id));
const arms=cohort==='main'?[...originals,...originals.filter(a=>a.weather?.traits!=='none'&&a.weather).map(a=>({...structuredClone(a),id:'reduced-'+a.id,weather:{...a.weather,thermalCandidate:'reduced-035'}}))]:originals.filter(a=>['control','hot-wet-shared'].includes(a.id));
assert.equal(arms.length,cohort==='main'?10:2);
const sharedPolicy={version:'shared-psych-v1',homeOddsBonus:.004,maximumOddsBonus:.006},matchDate='2026-11-13';
const fixtures=profiles.flatMap(p=>Array.from({length:trials},(_,trial)=>({id:`${studyId}-${p.id}-${trial}`,profile:p.id,trial,swap:Boolean(trial%2),seed:`century-thermal-reduction:${studyId}:${p.id}:${trial}`})));
const manifest={schema:'century-thermal-reduction-v1',classification:'lab-only-not-adopted',studyId,cohort,runtime,sourceSHA256,baseline,
 matchDate,profiles,profilesSHA256:hash(JSON.stringify(profiles)),profileFileSHA256:hash(profileBytes),arms,fixtures,trialsPerProfile:trials,
 coefficients:{weather:e.WEATHER_CANDIDATE,thermalCandidates:e.THERMAL_MODERATION_CANDIDATES,confidenceScale:.2,frustrationScale:1,sharedPsychology:sharedPolicy},environments:FIXED_WEATHER,
 analysisPlan:{primaryContrast:cohort==='main'?'reduced-hot-wet-traits-adverse minus hot-wet-traits-adverse':'hot-wet-shared minus control (Philadelphia)',
 primaryInterval:'Bonferroni-combined paired discordance Wilson, z=2.241403; nominal per contrast. Secondary/profile intervals not simultaneous.',
 priorPrimaryDiscordanceEstimate:null,samplePolicy:'Fixed before execution; separate fresh seeds, no pooling, tuning, replacement, outcome-dependent stopping or expansion.',
 reciprocalPolicy:cohort==='targeted'?'Norfolk view is the exact complement of the same physical outcomes, not extra independent fixtures.':null,
 interpretation:cohort==='main'?'Candidate screen; precision may not distinguish a modest coefficient difference or certify an eight-point ceiling.':'Independent shared-weather recheck; no thermal extremes or psychology in this cohort.'},
 replayPolicy:'First fixture per profile/arm full replay, first control versus frozen v1.0; every saved result full replay on resume.'};
const dir=path.join(labRoot,'runs',studyId);fs.mkdirSync(dir,{recursive:true});
const mf=path.join(dir,'manifest.json');if(fs.existsSync(mf))assert.deepEqual(readJSON(mf),manifest);else atomicJSON(mf,manifest,true);
const records=[],pool=[];let next=0,resumedFixtures=0;
try{await new Promise((resolve,reject)=>{
 let finished=0,failed=false;const fail=e=>{if(!failed){failed=true;reject(e);}};
 for(let i=0;i<Math.min(workers,fixtures.length);i++){
  const w=new Worker(new URL('./streak-worker.mjs',import.meta.url),{workerData:{dir,profiles,arms,matchDate,confidenceScale:.2,sharedPolicy,weatherStudy:true,requiredExecArgv:runtime.workerExecArgv}});pool.push(w);
  w.on('error',fail);w.on('exit',code=>{if(!failed&&finished<fixtures.length)fail(Error(`Worker exited ${code} before the study completed`));});
  w.on('message',msg=>{if(failed)return;if(msg.error){fail(Error(msg.fixtureId+': '+msg.error));return;}
   records.push(msg.record);resumedFixtures+=Number(msg.resumed);finished++;
   if(finished%32===0||finished===fixtures.length)console.log(JSON.stringify({cohort,completedFixtures:finished,totalFixtures:fixtures.length,engineResults:finished*arms.length}));
   if(finished===fixtures.length)resolve();else if(next<fixtures.length)w.postMessage(fixtures[next++]);
  });if(next<fixtures.length)w.postMessage(fixtures[next++]);
 }
});}finally{await Promise.all(pool.map(w=>w.terminate()));}
const order=new Map(fixtures.map((f,i)=>[f.id,i]));records.sort((a,b)=>order.get(a.fixture.id)-order.get(b.fixture.id));
verifyBaseline();verifyImportBoundary();assert.equal(sourceFingerprint(),sourceSHA256,'Source changed during study');
const summary={schema:'century-thermal-reduction-summary-v1',status:'completed',studyId,cohort,sourceSHA256,matchedFixtures:fixtures.length,engineResults:fixtures.length*arms.length,resumedFixtures,fullReplays:profiles.length*arms.length,frozenControls:profiles.length,records};
const sf=path.join(dir,'summary.json');if(fs.existsSync(sf)){const previous=readJSON(sf);previous.resumedFixtures=resumedFixtures;assert.deepEqual(previous,summary);}else atomicJSON(sf,summary,true);
console.log(JSON.stringify({status:'completed',cohort,matchedFixtures:fixtures.length,engineResults:summary.engineResults}));
