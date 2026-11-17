import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{Worker}from'node:worker_threads';
import{load,identity,root,hash,atomicJSON}from'./tools.mjs';import{planFile,loadPlan,harnessFingerprint}from'./spec.mjs';import{ensureQualifiedStudyProcess,qualifyStudyRuntime}from'../v2/runtime.mjs';
ensureQualifiedStudyProcess();const runtime=qualifyStudyRuntime(),[prefixArg,outArg,mode='study']=process.argv.slice(2);assert.ok(prefixArg&&outArg&&['study','preflight'].includes(mode));
const prefixDir=path.resolve(prefixArg),dir=path.resolve(outArg);fs.mkdirSync(path.join(dir,'arms'),{recursive:true});const e=await load({build:false}),plan=loadPlan();
const qFile=path.join(root,'runs/recovery-qualification/checks/qualification.json'),q=JSON.parse(fs.readFileSync(qFile));assert.equal(q.status,'passed');assert.equal(q.source.sourceSHA256,e.identity.sourceSHA256);assert.equal(q.matchedHistoricalOutcomes,1248);
const faultFile=path.join(root,'runs/storage-faults.json'),fault=JSON.parse(fs.readFileSync(faultFile));assert.equal(fault.status,'passed');
let fixtures=plan.fixtures;
if(mode==='preflight')fixtures=[plan.fixtures[0],plan.fixtures[32]].map(f=>({...f,id:'preflight-'+f.id,continuationSeed:hash('drop-counter-preflight-only:'+f.id)}));
else{const p=JSON.parse(fs.readFileSync(path.join(root,'runs/preflight/ledger-verification.json')));assert.equal(p.status,'passed');assert.equal(p.fullOutcomesVerified,8);assert.equal(p.harnessSHA256,harnessFingerprint());}
const manifest={schema:'drop-counter-targeted-v1',studyId:mode==='study'?'drop-counter-targeted-v1':'drop-counter-preflight-v1',mode,classification:'conditional-lab-not-adopted',
 sourceSHA256:e.identity.sourceSHA256,harnessSHA256:harnessFingerprint(),runtime,planSHA256:hash(fs.readFileSync(planFile)),qualificationSHA256:hash(fs.readFileSync(qFile)),faultProofSHA256:hash(fs.readFileSync(faultFile)),
 arms:Object.keys(plan.armDeltas),armDeltas:plan.armDeltas,fixtures,prefixes:plan.prefixes,primary:plan.primary,secondary:plan.secondary,operations:plan.operations};
const mf=path.join(dir,'manifest.json');if(fs.existsSync(mf))assert.deepEqual(JSON.parse(fs.readFileSync(mf)),manifest);else atomicJSON(mf,manifest,true);
const records=[];
for(let start=0;start<fixtures.length;start+=8){
 const chunk=fixtures.slice(start,start+8),pool=[];let next=0,finished=0,failed=false;
 try{await new Promise((resolve,reject)=>{
  const fail=err=>{if(!failed){failed=true;clearTimeout(timer);reject(err);}},timer=setTimeout(()=>fail(Error('Chunk exceeded 900 seconds; no automatic retry')),900000);
  for(let i=0;i<Math.min(2,chunk.length);i++){const w=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:{dir,prefixDir,requiredExecArgv:runtime.workerExecArgv}});pool.push(w);
   w.on('error',fail);w.on('exit',code=>{if(!failed&&finished<chunk.length)fail(Error('Worker exited '+code));});
   w.on('message',msg=>{if(failed)return;if(msg.error){fail(Error(msg.fixtureId+': '+msg.error));return;}records.push(msg.record);finished++;
    console.log(JSON.stringify({completedFixtures:records.length,totalFixtures:fixtures.length,outcomes:records.length*4}));
    if(finished===chunk.length){clearTimeout(timer);resolve();}else if(next<chunk.length)w.postMessage(chunk[next++]);});if(next<chunk.length)w.postMessage(chunk[next++]);}
 });}finally{await Promise.all(pool.map(w=>w.terminate()));}
}
assert.equal(identity().sourceSHA256,manifest.sourceSHA256);assert.equal(harnessFingerprint(),manifest.harnessSHA256);
const order=new Map(fixtures.map((f,i)=>[f.id,i]));records.sort((a,b)=>order.get(a.fixture.id)-order.get(b.fixture.id));
const summary={status:'completed',studyId:manifest.studyId,mode,sourceSHA256:manifest.sourceSHA256,harnessSHA256:manifest.harnessSHA256,matchedFixtures:fixtures.length,engineResults:fixtures.length*4,
 replayVerifiedOutcomes:records.flatMap(r=>r.arms).filter(r=>r.replayVerified).length,records};
const sf=path.join(dir,'summary.json');if(fs.existsSync(sf))assert.deepEqual(JSON.parse(fs.readFileSync(sf)),summary);else atomicJSON(sf,summary,true);console.log(JSON.stringify({status:'completed',mode,clusters:fixtures.length,outcomes:summary.engineResults,replays:summary.replayVerifiedOutcomes}));
