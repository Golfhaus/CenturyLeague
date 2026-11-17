import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';import {gunzipSync,gzipSync} from 'node:zlib';
import {loadEngines,hash,readJSON,labRoot,verifyBaseline} from './tools.mjs';
import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from './runtime.mjs';
import {CURVE_ARMS,curveInput} from './temperature-curve-fixtures.mjs';
ensureQualifiedStudyProcess();qualifyStudyRuntime();const e=await loadEngines(),file=process.argv[2],prior=process.argv[3];assert.ok(file&&prior);
const profiles=readJSON(file).profiles.filter(p=>/^pair-[1-4]-focal-0$/.test(p.id)),snapshot=hash(JSON.stringify(profiles));assert.equal(profiles.length,4);
let constructionChecks=0,legacyReplays=0;
for(const profile of profiles)for(const swap of [false,true])for(const arm of CURVE_ARMS){
 const input=curveInput(e,profile,{id:'heat-contract',seed:'heat-contract',swap},arm),side=Number(swap);
 assert.deepEqual(input.teams[side],profile.teams[0]);assert.deepEqual(input.teams[1-side],profile.teams[1]);
 assert.deepEqual(input.lab.enabled,[]);assert.deepEqual(input.weather.enabled,arm.traits==='normal'?['weather','temperature-tolerance']:['weather']);assert.equal(input.weather.conditions.relativeHumidity,80);
 const loads=e.weatherLoads(input.weather);assert.equal(loads.cold,0);assert.equal(loads.wet,0);assert.equal(loads.wind,0);
 assert.equal(loads.heat>0,arm.temperatureC>24);constructionChecks++;
}
assert.equal(hash(JSON.stringify(profiles)),snapshot);
const parity=r=>{const c=structuredClone(r);delete c.weatherTelemetry;delete c.labTelemetry;delete c.input.weather;delete c.engineVersion;for(const v of c.events)if(v.type==='match_start')delete v.data.engineVersion;return hash(JSON.stringify(c));};
let normalNeutralReplays=0,multiplierChecks=0;
for(const profile of profiles)for(const swap of [false,true]){
 const fixture={id:'curve-neutral-contract',seed:'curve-neutral-contract',swap};const control=curveInput(e,profile,fixture,CURVE_ARMS[0]);
 const normal=curveInput(e,profile,fixture,{id:'neutral-normal',temperatureC:18,traits:'normal',thermalCandidate:'reduced-035'});
 assert.equal(parity(e.simulateV2(control)),parity(e.simulateV2(normal)));normalNeutralReplays++;
 const traits=normal.weather.traits;
 for(const arm of CURVE_ARMS.filter(a=>a.traits==='normal')){
  const input=curveInput(e,profile,fixture,arm);assert.deepEqual(input.weather.traits,traits);
  for(const [id,t]of Object.entries(traits)){
   const load=(arm.temperatureC-24)/12*.94,m=arm.thermalCandidate==='reduced-035'?.35:.5;
   const got=e.thermalMultipliers(input.weather,id);assert.ok(Math.abs(got.fatigue-(1+.12*load*(1-m*(t.heat-.5))))<1e-12);
   assert.ok(Math.abs(got.recovery-(1-.04*load*(1-m*(t.heat-.5))))<1e-12);multiplierChecks++;
  }
 }
}

const oldm=readJSON(path.join(prior,'manifest.json'));
for(const f of oldm.fixtures.slice(0,2)){
 const saved=JSON.parse(gunzipSync(fs.readFileSync(path.join(prior,f.id+'.json.gz'))));
 for(const id of ['temperate','hot']){
  const result=saved.results[id];assert.equal(hash(JSON.stringify(e.simulateV2(result.input))),hash(JSON.stringify(result)));legacyReplays++;
 }
}
const id='curve-preflight-'+randomUUID(),dir=path.join(labRoot,'runs',id),args=[path.join(labRoot,'run-temperature-curve.mjs'),'--study-id',id,'--trials','2','--workers','8','--profiles',file];
const run=()=>spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:16*1024*1024});
try{
 let r=run();assert.equal(r.status,0,r.stderr+r.stdout);const m=readJSON(path.join(dir,'manifest.json')),s=readJSON(path.join(dir,'summary.json'));assert.equal(s.engineResults,80);
 r=run();assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(readJSON(path.join(dir,'summary.json')).records.length,8);
 const q=path.join(dir,m.fixtures[0].id+'.json.gz'),bytes=fs.readFileSync(q),bad=JSON.parse(gunzipSync(bytes));bad.results['t35-normal-035'].weatherTelemetry.energySeconds[0]+=1;
 fs.writeFileSync(q,gzipSync(JSON.stringify(bad)));r=run();assert.notEqual(r.status,0);assert.ok((r.stderr+r.stdout).includes('Full enabled replay failed'));fs.writeFileSync(q,bytes);
 console.log(JSON.stringify({status:'passed',constructionChecks,legacyResultsExactlyReplayed:legacyReplays,normalNeutralReplays,multiplierChecks,saveResumeOutcomes:80,
  calmParityAllFourMatchupsBothSides:true,rostersAndTacticsImmutable:true,corruptTelemetryRejected:true,baseline:verifyBaseline()}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
