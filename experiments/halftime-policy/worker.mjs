import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{parentPort,workerData}from'node:worker_threads';
import{load,hash,inputFor,stripDecisionEvents}from'./tools.mjs';import{harnessFingerprint,controls}from'./spec.mjs';import{auditPolicyResult}from'./audit-result.mjs';
import{writeOnce}from'../drop-counter/storage.mjs';import{readGzip,metrics}from'../drop-counter/tools.mjs';
const e=await load({build:false}),m=JSON.parse(fs.readFileSync(path.join(workerData.dir,'manifest.json'))),profiles=JSON.parse(fs.readFileSync(workerData.profilesFile)).profiles;
assert.equal(e.identity.sourceSHA256,m.sourceSHA256);assert.equal(harnessFingerprint(),m.harnessSHA256);assert.deepEqual(process.execArgv,workerData.requiredExecArgv);
parentPort.on('message',fixture=>{try{
 const profile=profiles.find(p=>p.id===fixture.profile);assert.ok(profile);const teams=structuredClone(profile.teams);if(fixture.focalSide===1)teams.reverse();
 const base=inputFor(e,teams,fixture.id,fixture.seed,'2026-11-17'),rows=[];let prefixHash,holdGameplay;
 for(const arm of m.arms){
  const input={...structuredClone(base),halftime:controls(arm,fixture.focalSide)},dest=path.join(workerData.dir,'arms',fixture.id+'--'+arm+'.json.gz');let payload;
  if(fs.existsSync(dest))payload=readGzip(dest);
  else{
   const result=e.simulate(input),resultSHA256=hash(JSON.stringify(result)),replayVerified=fixture.trial<2,replaySHA256=replayVerified?hash(JSON.stringify(e.simulate(input))):null;
   if(replayVerified)assert.equal(replaySHA256,resultSHA256,'Natural policy replay differed');
   payload={sourceSHA256:m.sourceSHA256,harnessSHA256:m.harnessSHA256,fixture,arm,resultSHA256,replayVerified,replaySHA256,result};
  }
  assert.equal(payload.sourceSHA256,m.sourceSHA256);assert.equal(payload.harnessSHA256,m.harnessSHA256);assert.deepEqual(payload.fixture,fixture);assert.equal(payload.arm,arm);assert.equal(hash(JSON.stringify(payload.result)),payload.resultSHA256);assert.deepEqual(payload.result.input,input);
  assert.equal(payload.replayVerified,fixture.trial<2);if(payload.replayVerified)assert.equal(payload.replaySHA256,payload.resultSHA256);
  const result=payload.result,{prefixEnd,decisions}=auditPolicyResult(result,e),thisPrefix=hash(JSON.stringify(result.events.slice(0,prefixEnd)));if(prefixHash)assert.equal(prefixHash,thisPrefix,'Paired first half changed');else prefixHash=thisPrefix;
  const gameplayHash=hash(JSON.stringify(stripDecisionEvents(result)));if(arm==='none')holdGameplay=gameplayHash;else if(decisions.every(d=>d.choice==='hold'))assert.equal(gameplayHash,holdGameplay,'No-op policy changed play');
  if(!fs.existsSync(dest))writeOnce(dest,payload);
  const focal=decisions[fixture.focalSide],opponent=decisions[1-fixture.focalSide],first=result.events.findIndex(x=>x.type==='halftime_decision'),event=result.events[first];
  const reference={payload:{state:{events:result.events.slice(0,first),score:{scores:focal.observation.scores},playing:event.playingSeconds,elapsed:event.elapsedSeconds}}};
  rows.push({fixture:fixture.id,profile:fixture.profile,template:fixture.template,gap:fixture.gap,quality:fixture.quality,tactics:fixture.tactics,trial:fixture.trial,focalSide:fixture.focalSide,arm,
   ...metrics(result,reference,fixture.focalSide),halfDeficit:focal.deficit,halfFocalScore:focal.observation.scores[fixture.focalSide],halfOpponentScore:focal.observation.scores[1-fixture.focalSide],
   focalChoice:focal.choice,opponentChoice:opponent.choice,focalRootDistance:focal.rootDistance,opponentRootDistance:opponent.rootDistance,
   firstHalfSHA256:thisPrefix,noOpBoth:decisions.every(d=>d.choice==='hold'),gameplaySHA256:gameplayHash,replayVerified:payload.replayVerified,resultSHA256:payload.resultSHA256,
   armFile:path.relative(workerData.dir,dest),armFileSHA256:hash(fs.readFileSync(dest))});
 }
 const record={sourceSHA256:m.sourceSHA256,harnessSHA256:m.harnessSHA256,fixture,arms:rows},dest=path.join(workerData.dir,fixture.id+'.json.gz');if(fs.existsSync(dest))assert.deepEqual(readGzip(dest),record);else writeOnce(dest,record);
 parentPort.postMessage({record});
}catch(error){parentPort.postMessage({fixtureId:fixture.id,error:error.stack||String(error)});}});
