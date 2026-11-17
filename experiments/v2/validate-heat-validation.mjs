import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';import {gunzipSync,gzipSync} from 'node:zlib';
import {loadEngines,hash,readJSON,labRoot,verifyBaseline} from './tools.mjs';
import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from './runtime.mjs';
import {HEAT_ARMS,heatInput} from './heat-fixtures.mjs';
ensureQualifiedStudyProcess();qualifyStudyRuntime();const e=await loadEngines(),file=process.argv[2],prior=process.argv[3];assert.ok(file&&prior);
const profiles=readJSON(file).profiles.filter(p=>/^pair-[1-4]-focal-0$/.test(p.id)),snapshot=hash(JSON.stringify(profiles));assert.equal(profiles.length,4);
let constructionChecks=0,legacyReplays=0;
for(const profile of profiles)for(const swap of [false,true])for(const arm of HEAT_ARMS){
 const input=heatInput(e,profile,{id:'heat-contract',seed:'heat-contract',swap},arm),side=Number(swap);
 assert.deepEqual(input.teams[side],profile.teams[0]);assert.deepEqual(input.teams[1-side],profile.teams[1]);
 assert.deepEqual(input.lab.enabled,[]);assert.deepEqual(input.weather.enabled,['weather']);assert.equal(input.weather.conditions.relativeHumidity,80);
 const loads=e.weatherLoads(input.weather);assert.equal(loads.cold,0);assert.equal(loads.wet,0);assert.equal(loads.wind,0);
 assert.equal(loads.heat>0,arm.id==='hot');constructionChecks++;
}
assert.equal(hash(JSON.stringify(profiles)),snapshot);
const oldm=readJSON(path.join(prior,'manifest.json'));
for(const f of oldm.fixtures.slice(0,2)){
 const saved=JSON.parse(gunzipSync(fs.readFileSync(path.join(prior,f.id+'.json.gz'))));
 for(const id of ['original-0','original-1']){
  const result=saved.results[id];assert.equal(hash(JSON.stringify(e.simulateV2(result.input))),hash(JSON.stringify(result)));legacyReplays++;
 }
}
const id='heat-preflight-'+randomUUID(),dir=path.join(labRoot,'runs',id),args=[path.join(labRoot,'run-heat-validation.mjs'),'--study-id',id,'--trials','2','--workers','2','--profiles',file];
const run=()=>spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:16*1024*1024});
try{
 let r=run();assert.equal(r.status,0,r.stderr+r.stdout);const m=readJSON(path.join(dir,'manifest.json')),s=readJSON(path.join(dir,'summary.json'));assert.equal(s.engineResults,16);
 r=run();assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(readJSON(path.join(dir,'summary.json')).records.length,8);
 const q=path.join(dir,m.fixtures[0].id+'.json.gz'),bytes=fs.readFileSync(q),bad=JSON.parse(gunzipSync(bytes));bad.results.hot.weatherTelemetry.energySeconds[0]+=1;
 fs.writeFileSync(q,gzipSync(JSON.stringify(bad)));r=run();assert.notEqual(r.status,0);assert.ok((r.stderr+r.stdout).includes('Full enabled replay failed'));fs.writeFileSync(q,bytes);
 console.log(JSON.stringify({status:'passed',constructionChecks,legacyResultsExactlyReplayed:legacyReplays,saveResumeOutcomes:16,
  calmParityAllFourMatchupsBothSides:true,rostersAndTacticsImmutable:true,corruptTelemetryRejected:true,baseline:verifyBaseline()}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
