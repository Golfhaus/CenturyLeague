import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync}from'node:child_process';import{randomUUID}from'node:crypto';import{gunzipSync,gzipSync}from'node:zlib';
import{loadEngines,hash,readJSON,labRoot,sourceFingerprint,verifyBaseline}from'./tools.mjs';import{ensureQualifiedStudyProcess,qualifyStudyRuntime}from'./runtime.mjs';
import{stageArms,stageInput}from'./modifier-stage-fixtures.mjs';import{coldInput}from'./cold-fixtures.mjs';
ensureQualifiedStudyProcess();qualifyStudyRuntime();const e=await loadEngines(),file=process.argv[2],old=process.argv[3];assert.ok(file&&old);
const profiles=readJSON(file).profiles.filter(p=>/^pair-[1-4]-focal-0$/.test(p.id)),snapshot=hash(JSON.stringify(profiles));let constructions=0,legacy=0;
for(const stage of ['cold-confirmation','combined'])for(const p of profiles)for(const swap of [false,true])for(const arm of stageArms(stage)){
 const f={id:'stage-contract',seed:'stage-contract',swap},input=stageInput(e,p,f,arm,stage),side=Number(swap);
 assert.deepEqual(input.teams[side],p.teams[0]);assert.deepEqual(input.teams[1-side],p.teams[1]);
 if(stage==='cold-confirmation')assert.deepEqual(input,coldInput(e,p,f,arm));
 else{
  const favored=arm.psychology==='favored';assert.equal(input.lab.confidenceScale,.2);assert.equal(input.lab.psychology.maximumOddsBonus,.006);assert.equal(input.lab.psychology.homeOddsBonus,.004);
  assert.deepEqual(input.lab.enabled,arm.psychology?['confidence','frustration','home-support']:[]);
  assert.equal(input.lab.psychology.homeSide,arm.psychology?(favored?side:1-side):null);
  assert.equal(input.lab.streaks[side],arm.psychology?(favored?5:-5):0);assert.equal(input.lab.streaks[1-side],arm.psychology?(favored?-5:5):0);
  if(arm.environment){
   assert.equal(input.weather.thermalCandidate,'reduced-035');assert.equal(input.weather.conditions.temperatureC,arm.environment==='cold'?-5:35);
   for(let s=0;s<2;s++)for(const q of input.teams[s].players){const good=arm.physical==='favored'?s===side:s!==side;assert.deepEqual(input.weather.traits[q.id],arm.environment==='cold'?{heat:.5,cold:Number(good)}:{heat:Number(good),cold:.5});}
  }else{assert.equal(input.weather.conditions.temperatureC,18);assert.equal(input.weather.conditions.rainMmPerHour,0);}
 }
 constructions++;
}
const om=readJSON(path.join(old,'manifest.json'));
for(const f of om.fixtures.slice(0,2)){const saved=JSON.parse(gunzipSync(fs.readFileSync(path.join(old,f.id+'.json.gz'))));for(const id of ['wet-5','wet-5-adverse-035']){const r=saved.results[id];assert.equal(hash(JSON.stringify(e.simulateV2(r.input))),hash(JSON.stringify(r)));legacy++;}}
const root=path.join(labRoot,'runs','modifier-preflight-'+randomUUID());fs.mkdirSync(root,{recursive:true});const gateFile=path.join(root,'gate.json'),gate={confirmed:true,testOnly:true,sourceSHA256:sourceFingerprint()};fs.writeFileSync(gateFile,JSON.stringify(gate));
const run=(stage,id,extra=[])=>spawnSync(process.execPath,[path.join(labRoot,'run-modifier-stage.mjs'),'--stage',stage,'--study-id',id,'--trials','2','--workers','8','--profiles',file,...extra],{encoding:'utf8',maxBuffer:16*1024*1024});
const dirs=[];
try{
 const badId='bad-gate-research-'+randomUUID();let r=run('combined',badId);assert.notEqual(r.status,0);assert.ok((r.stdout+r.stderr).includes('requires a confirmed cold gate'));
 r=run('combined',badId,['--gate',gateFile]);assert.notEqual(r.status,0);assert.ok((r.stdout+r.stderr).includes('Test gate cannot authorize research'));
 fs.writeFileSync(gateFile,JSON.stringify({...gate,confirmed:false}));r=run('combined','modifier-preflight-'+randomUUID(),['--gate',gateFile]);assert.notEqual(r.status,0);assert.ok((r.stdout+r.stderr).includes('condition not met'));
 fs.writeFileSync(gateFile,JSON.stringify({...gate,sourceSHA256:'0'.repeat(64)}));r=run('combined','modifier-preflight-'+randomUUID(),['--gate',gateFile]);assert.notEqual(r.status,0);assert.ok((r.stdout+r.stderr).includes('Gate source differs'));
 fs.writeFileSync(gateFile,JSON.stringify(gate));
 for(const stage of ['cold-confirmation','combined']){
  const id='modifier-preflight-'+randomUUID(),dir=path.join(labRoot,'runs',id),extra=stage==='combined'?['--gate',gateFile]:[];dirs.push(dir);
  r=run(stage,id,extra);assert.equal(r.status,0,r.stdout+r.stderr);const m=readJSON(path.join(dir,'manifest.json')),s=readJSON(path.join(dir,'summary.json'));assert.equal(s.engineResults,stage==='combined'?88:16);
  r=run(stage,id,extra);assert.equal(r.status,0,r.stdout+r.stderr);
  const q=path.join(dir,m.fixtures[0].id+'.json.gz'),bytes=fs.readFileSync(q),bad=JSON.parse(gunzipSync(bytes));const arm=stage==='combined'?'cold-combined-adverse':'wet-5-adverse-035';bad.results[arm].labTelemetry.contacts[0]+=1;
  fs.writeFileSync(q,gzipSync(JSON.stringify(bad)));r=run(stage,id,extra);assert.notEqual(r.status,0);assert.ok((r.stdout+r.stderr).includes('Full enabled replay failed'));fs.writeFileSync(q,bytes);
 }
 assert.equal(hash(JSON.stringify(profiles)),snapshot);
 console.log(JSON.stringify({status:'passed',constructionChecks:constructions,legacyResultsExactlyReplayed:legacy,saveResumeOutcomes:104,combinedColdGateRejectionsVerified:true,corruptLabTelemetryRejected:true,neutralV1ParityBothSides:true,sharedPsychologyCapAndFoulCountersVerified:true,rostersAndTacticsImmutable:true,baseline:verifyBaseline()}));
}finally{for(const d of dirs)fs.rmSync(d,{recursive:true,force:true});fs.rmSync(root,{recursive:true,force:true});}
