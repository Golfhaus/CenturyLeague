import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';import{randomUUID}from'node:crypto';import{gunzipSync,gzipSync}from'node:zlib';
import{loadEngines,hash,readJSON,labRoot}from'./tools.mjs';import{ensureQualifiedStudyProcess,qualifyStudyRuntime}from'./runtime.mjs';import{FACTORIAL_ARMS,FACTORIAL_POLICY,factorialInput}from'./factorial-fixtures.mjs';
ensureQualifiedStudyProcess();qualifyStudyRuntime();const e=await loadEngines(),file=process.argv[2],prior=process.argv[3];assert.ok(file&&prior);
const profile=readJSON(file).profiles.find(p=>p.id==='pair-3-focal-1'),snapshot=hash(JSON.stringify(profile));let constructionChecks=0,legacyReplays=0;
for(const swap of [false,true])for(const arm of FACTORIAL_ARMS){
 const input=factorialInput(e,profile,{id:'factorial-contract',seed:'factorial-contract',swap},arm),side=swap?1:0,c=input.weather.conditions;
 const expected=structuredClone(profile.teams[0]);if(arm.context==='matched')Object.assign(expected.coach.tactics,FACTORIAL_POLICY.matched);
 assert.deepEqual(input.teams[side],expected);assert.deepEqual(input.teams[1-side],profile.teams[1]);assert.deepEqual(input.lab.enabled,[]);assert.deepEqual(input.weather.enabled,['weather']);
 const loads=e.weatherLoads(input.weather);assert.equal(loads.cold,0);assert.equal(loads.wet,arm.rain?1:0);assert.equal(loads.wind,arm.wind?1:0);assert.equal(c.relativeHumidity,80);
 assert.equal(c.temperatureC,arm.heat?35:18);assert.equal(c.gustKmh,arm.wind?50:0);constructionChecks++;
}
assert.equal(hash(JSON.stringify(profile)),snapshot);
const oldm=readJSON(path.join(prior,'manifest.json'));
for(const f of oldm.fixtures.slice(0,2)){
 const saved=JSON.parse(gunzipSync(fs.readFileSync(path.join(prior,f.id+'.json.gz'))));
 const full=factorialInput(e,profile,f,FACTORIAL_ARMS.find(a=>a.context==='original'&&a.mask===7));
 assert.deepEqual(full,saved.results['hot-wet-shared'].input);assert.equal(hash(JSON.stringify(e.simulateV2(full))),hash(JSON.stringify(saved.results['hot-wet-shared'])));legacyReplays++;
 const control=structuredClone(full);delete control.weather;assert.deepEqual(control,saved.results.control.input);
 assert.equal(hash(JSON.stringify(e.simulateV2(control))),hash(JSON.stringify(saved.results.control)));legacyReplays++;
}
const id='factorial-preflight-'+randomUUID(),dir=path.join(labRoot,'runs',id),args=[path.join(labRoot,'run-weather-factorial.mjs'),'--study-id',id,'--trials','2','--workers','2','--profiles',file];
const run=()=>spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:16*1024*1024});
try{
 let r=run();assert.equal(r.status,0,r.stderr+r.stdout);const m=readJSON(path.join(dir,'manifest.json')),s=readJSON(path.join(dir,'summary.json'));assert.equal(s.engineResults,32);
 r=run();assert.equal(r.status,0,r.stderr+r.stdout);
 const q=path.join(dir,m.fixtures[0].id+'.json.gz'),bytes=fs.readFileSync(q),bad=JSON.parse(gunzipSync(bytes));bad.results['original-7'].weatherTelemetry.energySeconds[0]+=1;
 fs.writeFileSync(q,gzipSync(JSON.stringify(bad)));r=run();assert.notEqual(r.status,0);assert.ok((r.stderr+r.stdout).includes('Full enabled replay failed'));fs.writeFileSync(q,bytes);
 assert.equal(hash(JSON.stringify(profile)),snapshot);
 console.log(JSON.stringify({status:'passed',constructionChecks,legacyResultsExactlyReplayed:legacyReplays,saveResumeOutcomes:32,calmParityBothContextsBothSides:true,rostersImmutable:true,onlyDeclaredTacticsChanged:true,corruptTelemetryRejected:true}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
