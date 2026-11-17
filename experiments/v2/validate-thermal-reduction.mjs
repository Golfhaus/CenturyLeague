import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';import {gunzipSync,gzipSync} from 'node:zlib';
import {loadEngines,labRoot,readJSON} from './tools.mjs';import {FIXED_WEATHER} from './weather-fixtures.mjs';
const e=await loadEngines(),setting={version:'fixed-weather-v1',enabled:['weather','temperature-tolerance'],endPolicy:'alternate-quarters',conditions:FIXED_WEATHER.hotWet,traits:{p:{heat:0,cold:.5}}};
const old=e.thermalMultipliers(setting,'p'),mean=e.thermalMultipliers({...setting,traits:{p:{heat:.5,cold:.5}}},'p');
const reduced=e.thermalMultipliers({...setting,thermalCandidate:'reduced-035'},'p');
assert.ok(Math.abs((reduced.fatigue-mean.fatigue)/(old.fatigue-mean.fatigue)-.7)<1e-12);
assert.ok(Math.abs((reduced.recovery-mean.recovery)/(old.recovery-mean.recovery)-.7)<1e-12);
assert.deepEqual(e.thermalMultipliers({...setting,thermalCandidate:'original-050'},'p'),old);
for(const c of ['original-050','reduced-035']){
 assert.deepEqual(e.thermalMultipliers({...setting,conditions:FIXED_WEATHER.calm,thermalCandidate:c},'p'),{fatigue:1,recovery:1});
 assert.deepEqual(e.thermalMultipliers({...setting,traits:{p:{heat:.5,cold:.5}},thermalCandidate:c},'p'),mean);
}
assert.throws(()=>e.resolveWeather({...setting,thermalCandidate:'unknown'},['p']));
assert.throws(()=>e.resolveWeather({...setting,enabled:['weather'],thermalCandidate:'reduced-035'},['p']));
const file=process.argv[2];assert.ok(file);let outcomes=0;
for(const cohort of ['main','targeted']){
 const id='thermal-reduction-preflight-'+cohort+'-'+randomUUID(),dir=path.join(labRoot,'runs',id);
 const args=[path.join(labRoot,'run-thermal-reduction.mjs'),'--cohort',cohort,'--study-id',id,'--trials','2','--workers','2','--profiles',file];
 const run=()=>spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:16*1024*1024});
 try{
  let r=run();assert.equal(r.status,0,r.stderr+r.stdout);const m=readJSON(path.join(dir,'manifest.json')),s=readJSON(path.join(dir,'summary.json'));
  assert.equal(s.engineResults,cohort==='main'?160:4);outcomes+=s.engineResults;
  if(cohort==='main')for(const f of m.fixtures){const saved=JSON.parse(gunzipSync(fs.readFileSync(path.join(dir,f.id+'.json.gz')))),side=f.swap?1:0;
   for(const role of ['favored','adverse']){const input=saved.results['reduced-hot-wet-traits-'+role].input;assert.equal(input.weather.thermalCandidate,'reduced-035');
    for(const p of input.teams[side].players)assert.equal(input.weather.traits[p.id].heat,role==='favored'?1:0);
    assert.deepEqual(input.teams[side],m.profiles.find(p=>p.id===f.profile).teams[0]);}
  }
  r=run();assert.equal(r.status,0,r.stderr+r.stdout);
  const savedFile=path.join(dir,m.fixtures[0].id+'.json.gz'),bytes=fs.readFileSync(savedFile),bad=JSON.parse(gunzipSync(bytes));
  bad.results['hot-wet-shared'].weatherTelemetry.extraRequestedFatigue[0]+=1;fs.writeFileSync(savedFile,gzipSync(JSON.stringify(bad)));
  r=run();assert.notEqual(r.status,0);assert.ok((r.stderr+r.stdout).includes('Full enabled replay failed'));fs.writeFileSync(savedFile,bytes);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
console.log(JSON.stringify({status:'passed',saveResumeOutcomes:outcomes,energyDifferentialRatio:.7,neutralTraitParity:true,legacyDefaultUnchanged:true,roleSideChecks:true,corruptTelemetryRejected:true}));
