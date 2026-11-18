import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {parentPort,workerData} from 'node:worker_threads';
import {load,hash,stripDecisionEvents} from '../halftime-boundary/tools.mjs';import {auditPolicyResult} from './audit-result.mjs';import {writeOnce} from '../drop-counter/storage.mjs';import {readGzip} from '../drop-counter/tools.mjs';import {assertIdentity,inputForCase,rowFor,prefixGroup} from './spec.mjs';
const e=await load({build:false}),m=JSON.parse(fs.readFileSync(path.join(workerData.dir,'manifest.json'))),profiles=JSON.parse(fs.readFileSync(workerData.profilesFile)).profiles;assertIdentity(m);assert.deepEqual(process.execArgv,workerData.requiredExecArgv);
parentPort.on('message',f=>{try{
 const p=profiles.find(p=>p.id===f.profile);assert.ok(p);const rows=[],prefixes=new Map(),controls=new Map(),observations=new Map();
 for(const arm of m.arms){const input=inputForCase(e,p,f,arm),dest=path.join(workerData.dir,'arms',f.id+'--'+arm+'.json.gz');let saved;
  if(fs.existsSync(dest))saved=readGzip(dest);else{const result=e.simulate(input),resultSHA256=hash(JSON.stringify(result)),replayVerified=f.replay,replaySHA256=replayVerified?hash(JSON.stringify(e.simulate(input))):null;saved={sourceSHA256:m.sourceSHA256,harnessSHA256:m.harnessSHA256,fixture:f,arm,resultSHA256,replayVerified,replaySHA256,result};}
  assert.equal(saved.sourceSHA256,m.sourceSHA256);assert.equal(saved.harnessSHA256,m.harnessSHA256);assert.deepEqual(saved.fixture,f);assert.equal(saved.arm,arm);assert.deepEqual(saved.result.input,input);assert.equal(hash(JSON.stringify(saved.result)),saved.resultSHA256);assert.equal(saved.replayVerified,f.replay);if(saved.replayVerified)assert.equal(saved.replaySHA256,saved.resultSHA256);
  const proof=auditPolicyResult(saved.result,e),row=rowFor(saved.result,f,arm),key=prefixGroup(arm),gameplaySHA256=hash(JSON.stringify(stripDecisionEvents(saved.result))),obs=proof.decisions.map(d=>d.observation);
  if(prefixes.has(key)){assert.equal(prefixes.get(key),row.firstHalfSHA256);assert.deepEqual(obs,observations.get(key));}else{prefixes.set(key,row.firstHalfSHA256);observations.set(key,obs);}
  if(arm[2]==='0')controls.set(key,gameplaySHA256);else if(proof.decisions.every(d=>d.choice==='hold'))assert.equal(gameplaySHA256,controls.get(key),'No-op changed otherwise identical gameplay');
  if(!fs.existsSync(dest))writeOnce(dest,saved);rows.push({...row,gameplaySHA256,replayVerified:saved.replayVerified,armFile:path.relative(workerData.dir,dest),armFileSHA256:hash(fs.readFileSync(dest))});
 }
 const record={fixture:f,arms:rows},dest=path.join(workerData.dir,f.id+'.json.gz');if(fs.existsSync(dest))assert.deepEqual(readGzip(dest),record);else writeOnce(dest,record);parentPort.postMessage({record});
 }catch(err){parentPort.postMessage({error:err.stack||String(err),fixtureId:f.id});}});
