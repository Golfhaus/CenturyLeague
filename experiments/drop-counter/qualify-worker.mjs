import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{parentPort,workerData}from'node:worker_threads';
import{load,readGzip,hash,metrics,auditFull}from'./tools.mjs';
const e=await load({build:false}),dir=workerData.dataDir,m=JSON.parse(fs.readFileSync(path.join(dir,'study/manifest.json')));
parentPort.on('message',record=>{try{
 const f=record.fixture,p=m.prefixes.find(p=>p.context===f.context&&p.trailingSide===f.trailingSide),context=m.contexts.find(c=>c.context===f.context&&c.trailingSide===f.trailingSide);
 const file=path.join(dir,'prefixes',p.file);assert.equal(hash(fs.readFileSync(file)),p.fileSHA256);const env=readGzip(file);assert.equal(hash(JSON.stringify(env.payload)),p.snapshotSHA256);
 let checked=0;
 for(const expected of record.arms){const arm=context.arms.find(a=>a.id===expected.probe);assert.ok(arm);const result=e.resume(env,f.trailingSide,arm.delta,f.continuationSeed);
  auditFull(result,e);const actual=metrics(result,env,f.trailingSide);for(const[k,v]of Object.entries(actual))assert.equal(v,expected[k],f.id+' '+arm.id+' '+k);checked++;}
 parentPort.postMessage({fixture:f.id,matchedMetrics:checked});
}catch(error){parentPort.postMessage({error:error.stack||String(error),fixture:record.fixture.id});}});
