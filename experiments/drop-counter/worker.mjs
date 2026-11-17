import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{parentPort,workerData}from'node:worker_threads';
import{load,hash,readGzip,metrics,auditFull}from'./tools.mjs';import{writeOnce}from'./storage.mjs';import{harnessFingerprint}from'./spec.mjs';
const e=await load({build:false}),m=JSON.parse(fs.readFileSync(path.join(workerData.dir,'manifest.json')));assert.deepEqual(process.execArgv,workerData.requiredExecArgv);
assert.equal(e.identity.sourceSHA256,m.sourceSHA256);assert.equal(harnessFingerprint(),m.harnessSHA256);
parentPort.on('message',fixture=>{try{
 const p=m.prefixes.find(p=>p.context===fixture.context&&p.trailingSide===fixture.trailingSide);assert.ok(p);
 const file=path.join(workerData.prefixDir,p.file);assert.equal(hash(fs.readFileSync(file)),p.fileSHA256);const env=readGzip(file),before=env.sha256;assert.equal(hash(JSON.stringify(env.payload)),p.snapshotSHA256);
 const rows=[];
 for(const arm of m.arms){
  const delta=m.armDeltas[arm],dest=path.join(workerData.dir,'arms',fixture.id+'--'+arm+'.json.gz');let payload;
  if(fs.existsSync(dest))payload=readGzip(dest);
  else{
   const result=e.resume(env,fixture.trailingSide,delta,fixture.continuationSeed),resultSHA256=hash(JSON.stringify(result)),replayVerified=fixture.trial<2;
   const replaySHA256=replayVerified?hash(JSON.stringify(e.resume(env,fixture.trailingSide,delta,fixture.continuationSeed))):null;
   if(replayVerified)assert.equal(replaySHA256,resultSHA256,'Conditional replay changed');
   payload={sourceSHA256:m.sourceSHA256,harnessSHA256:m.harnessSHA256,prefixSourceSHA256:env.payload.sourceIdentity,fixture,arm,delta,snapshotSHA256:before,resultSHA256,replayVerified,replaySHA256,result};
  }
  assert.equal(payload.sourceSHA256,m.sourceSHA256);assert.equal(payload.harnessSHA256,m.harnessSHA256);assert.deepEqual(payload.fixture,fixture);assert.equal(payload.arm,arm);assert.deepEqual(payload.delta,delta);assert.equal(payload.snapshotSHA256,before);
  assert.equal(hash(JSON.stringify(payload.result)),payload.resultSHA256);assert.equal(payload.replayVerified,fixture.trial<2);if(payload.replayVerified)assert.equal(payload.replaySHA256,payload.resultSHA256);
  const result=payload.result;assert.deepEqual(result.input,env.payload.input);assert.deepEqual(result.events.slice(0,env.payload.state.events.length),env.payload.state.events);
  const decisions=result.events.filter(x=>x.type==='halftime_decision');assert.equal(decisions.length,2);
  for(const side of [0,1]){const expected={...env.payload.input.teams[side].coach.tactics};if(side===fixture.trailingSide)for(const[k,v]of Object.entries(delta))expected[k]+=v;assert.deepEqual(decisions.find(d=>d.side===side).data.effectiveTactics,expected);}
  auditFull(result,e);if(!fs.existsSync(dest))writeOnce(dest,payload);
  rows.push({fixture:fixture.id,context:fixture.context,template:fixture.template,trailingSide:fixture.trailingSide,trial:fixture.trial,arm,...metrics(result,env,fixture.trailingSide),
   replayVerified:payload.replayVerified,resultSHA256:payload.resultSHA256,armFile:path.relative(workerData.dir,dest),armFileSHA256:hash(fs.readFileSync(dest))});
 }
 assert.equal(hash(JSON.stringify(env.payload)),before);const record={sourceSHA256:m.sourceSHA256,harnessSHA256:m.harnessSHA256,fixture,arms:rows},dest=path.join(workerData.dir,fixture.id+'.json.gz');
 if(fs.existsSync(dest))assert.deepEqual(readGzip(dest),record);else writeOnce(dest,record);
 parentPort.postMessage({record});
}catch(error){parentPort.postMessage({fixtureId:fixture.id,error:error.stack||String(error)});}});
