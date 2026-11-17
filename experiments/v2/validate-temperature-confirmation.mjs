import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';import {gunzipSync,gzipSync} from 'node:zlib';
import {loadEngines,hash,readJSON,labRoot,verifyBaseline,sportingJSON} from './tools.mjs';
import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from './runtime.mjs';
import {CONFIRM_CASES,confirmationArms,confirmationInput} from './temperature-confirmation-fixtures.mjs';
import {CURVE_ARMS,curveInput} from './temperature-curve-fixtures.mjs';
ensureQualifiedStudyProcess();qualifyStudyRuntime();const e=await loadEngines(),file=process.argv[2],prior=process.argv[3];assert.ok(file&&prior);
const profiles=readJSON(file).profiles,snapshot=hash(JSON.stringify(profiles));let constructionChecks=0,neutralChecks=0,legacyReplays=0;
const parity=r=>{const c=structuredClone(r);delete c.weatherTelemetry;delete c.labTelemetry;delete c.input.weather;return sportingJSON(c);};
for(const c of CONFIRM_CASES)for(const swap of [false,true]){
 const p=profiles.find(p=>p.id===c.profile),f={id:'confirm-contract',seed:'confirm-contract',profile:p.id,caseId:c.id,swap};
 for(const arm of confirmationArms(f)){
  const input=confirmationInput(e,p,f,arm),expected=curveInput(e,p,f,CURVE_ARMS.find(a=>a.id===c[arm.id]));assert.deepEqual(input,expected);
  assert.deepEqual(input.teams[Number(swap)],p.teams[0]);assert.deepEqual(input.teams[1-Number(swap)],p.teams[1]);constructionChecks++;
 }
 const neutral=curveInput(e,p,f,CURVE_ARMS[0]),frozen=structuredClone(neutral);delete frozen.weather;
 assert.equal(hash(parity(e.simulateV2(neutral))),hash(parity(e.simulateV1(frozen))));neutralChecks++;
 assert.throws(()=>confirmationArms({...f,profile:'invalid-profile'}),/Case\/profile mismatch/);
}
const oldm=readJSON(path.join(prior,'manifest.json'));
for(const f of oldm.fixtures.slice(0,2)){
 const saved=JSON.parse(gunzipSync(fs.readFileSync(path.join(prior,f.id+'.json.gz'))));
 for(const id of ['temperate','t35-normal-035']){const r=saved.results[id];assert.equal(hash(JSON.stringify(e.simulateV2(r.input))),hash(JSON.stringify(r)));legacyReplays++;}
}
const id='confirmation-preflight-'+randomUUID(),dir=path.join(labRoot,'runs',id),args=[path.join(labRoot,'run-temperature-confirmation.mjs'),'--study-id',id,'--trials','2','--workers','8','--profiles',file];
const run=()=>spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:16*1024*1024});
try{
 let r=run();assert.equal(r.status,0,r.stderr+r.stdout);const m=readJSON(path.join(dir,'manifest.json')),s=readJSON(path.join(dir,'summary.json'));assert.equal(s.engineResults,12);assert.equal(s.records.length,6);
 r=run();assert.equal(r.status,0,r.stderr+r.stdout);
 const q=path.join(dir,m.fixtures[0].id+'.json.gz'),bytes=fs.readFileSync(q),bad=JSON.parse(gunzipSync(bytes));bad.results.candidate.weatherTelemetry.energySeconds[0]+=1;
 fs.writeFileSync(q,gzipSync(JSON.stringify(bad)));r=run();assert.notEqual(r.status,0);assert.ok((r.stderr+r.stdout).includes('Full enabled replay failed'));fs.writeFileSync(q,bytes);
 assert.equal(hash(JSON.stringify(profiles)),snapshot);
 console.log(JSON.stringify({status:'passed',constructionChecks,neutralV1ParityChecks:neutralChecks,legacyResultsExactlyReplayed:legacyReplays,
  saveResumeOutcomes:12,caseProfileMismatchRejected:true,rostersAndTacticsImmutable:true,corruptTelemetryRejected:true,baseline:verifyBaseline()}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
