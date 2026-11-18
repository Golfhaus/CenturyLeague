import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {parentPort,workerData} from 'node:worker_threads';
import {load,hash,stripDecisionEvents} from '../halftime-boundary/tools.mjs';import {auditPolicyResult} from '../halftime-policy/audit-result.mjs';import {writeOnce} from '../drop-counter/storage.mjs';import {readGzip} from '../drop-counter/tools.mjs';import {assertIdentity,inputForCase,rowFor} from './spec.mjs';
const e=await load({build:false}),m=JSON.parse(fs.readFileSync(path.join(workerData.dir,'manifest.json'))),profiles=JSON.parse(fs.readFileSync(workerData.profilesFile)).profiles;assertIdentity(m);assert.deepEqual(process.execArgv,workerData.requiredExecArgv);
parentPort.on('message',f=>{try{
 const p=profiles.find(p=>p.id===f.profile);assert.ok(p);const rows=[];let prefix,hold;
 for(const arm of m.arms){const input=inputForCase(e,p,f,arm),dest=path.join(workerData.dir,'arms',f.id+'--'+arm+'.json.gz');let saved;
  if(fs.existsSync(dest))saved=readGzip(dest);else{const result=e.simulate(input),replayVerified=f.trial===0,replaySHA256=replayVerified?hash(JSON.stringify(e.simulate(input))):null;
   saved={sourceSHA256:m.sourceSHA256,harnessSHA256:m.harnessSHA256,fixture:f,arm,resultSHA256:hash(JSON.stringify(result)),replayVerified,replaySHA256,result};}
  assert.equal(saved.sourceSHA256,m.sourceSHA256);assert.equal(saved.harnessSHA256,m.harnessSHA256);assert.deepEqual(saved.fixture,f);assert.equal(saved.arm,arm);assert.deepEqual(saved.result.input,input);assert.equal(hash(JSON.stringify(saved.result)),saved.resultSHA256);assert.equal(saved.replayVerified,f.trial===0);if(saved.replayVerified)assert.equal(saved.replaySHA256,saved.resultSHA256);
  const proof=auditPolicyResult(saved.result,e),row=rowFor(e,saved.result,f,arm),gameplaySHA256=hash(JSON.stringify(stripDecisionEvents(saved.result)));
  if(prefix)assert.equal(prefix,row.firstHalfSHA256);else prefix=row.firstHalfSHA256;if(arm==='hold')hold=gameplaySHA256;else if(row.choice==='hold')assert.equal(gameplaySHA256,hold);
  assert.equal(proof.decisions[1-f.focalSide].choice,'hold');if(!fs.existsSync(dest))writeOnce(dest,saved);
  const selected=proof.decisions[f.focalSide].candidates.find(c=>c.id===row.choice);if(selected&&['aerial','lower-aerial'].includes(selected.recipe))assert.notEqual(selected.tactics.aerial_emphasis,proof.decisions[f.focalSide].observation.root.aerial_emphasis);
  rows.push({...row,gameplaySHA256,replayVerified:saved.replayVerified,armFile:path.relative(workerData.dir,dest),armFileSHA256:hash(fs.readFileSync(dest))});
 }
 const record={fixture:f,arms:rows},dest=path.join(workerData.dir,f.id+'.json.gz');if(fs.existsSync(dest))assert.deepEqual(readGzip(dest),record);else writeOnce(dest,record);parentPort.postMessage({record});
 }catch(err){parentPort.postMessage({error:err.stack||String(err),fixtureId:f.id});}});
