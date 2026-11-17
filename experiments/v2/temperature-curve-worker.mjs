import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {parentPort,workerData}from'node:worker_threads';import{gzipSync,gunzipSync}from'node:zlib';import{randomUUID}from'node:crypto';
import{loadEngines,hash,auditResult,sportingJSON}from'./tools.mjs';import{CURVE_ARMS,curveInput}from'./temperature-curve-fixtures.mjs';
const e=await loadEngines(false);assert.deepEqual(process.execArgv,workerData.requiredExecArgv);
const parity=r=>{const c=structuredClone(r);delete c.weatherTelemetry;delete c.labTelemetry;delete c.input.weather;return sportingJSON(c);};
parentPort.on('message',fixture=>{try{
 const profile=workerData.profiles.find(p=>p.id===fixture.profile);assert.ok(profile);
 const snapshot=hash(JSON.stringify(profile)),file=path.join(workerData.dir,fixture.id+'.json.gz');
 const saved=fs.existsSync(file)?JSON.parse(gunzipSync(fs.readFileSync(file))):null;
 if(saved)assert.deepEqual(saved.fixture,fixture);
 const results={},rows=[],side=fixture.swap?1:0;
 for(const arm of CURVE_ARMS){
  const input=curveInput(e,profile,fixture,arm),before=hash(JSON.stringify(input));
  const result=saved?saved.results[arm.id]:e.simulateV2(input);Object.freeze(result);assert.equal(result.engineVersion,'2.0.0-lab');auditResult(result,e);
  assert.equal(hash(JSON.stringify(result.input)),before,'Saved input differs');
  if(saved||fixture.trial<2)assert.equal(hash(JSON.stringify(e.simulateV2(input))),hash(JSON.stringify(result)),'Full enabled replay failed');
  if(fixture.trial<2&&arm.id==='temperate'){const neutral=structuredClone(input);delete neutral.weather;
   assert.equal(hash(parity(result)),hash(parity(e.simulateV1(neutral))),'Calm parity differs from frozen v1.0');}
  assert.equal(hash(JSON.stringify(input)),before,'Input changed');
  const final=result.events.at(-1).data.finalCondition;
  const energy=s=>final.filter(p=>input.teams[s].players.some(q=>q.id===p.playerId)).reduce((a,p)=>a+p.energy,0)/35;
  rows.push({id:arm.id,focalWin:Number(result.winner===side),focalScore:result.scores[side],opponentScore:result.scores[1-side],
   playingSeconds:result.playingSeconds,focalShots:result.teamStats[side].shots,opponentShots:result.teamStats[1-side].shots,
   focalMeanFinalEnergy:energy(side),opponentMeanFinalEnergy:energy(1-side),weather:result.weatherTelemetry,resultSHA256:hash(JSON.stringify(result))});
  results[arm.id]=result;
 }
 for(const row of rows){auditResult(results[row.id],e);assert.equal(hash(JSON.stringify(results[row.id])),row.resultSHA256,'Retained result changed');}
 assert.equal(hash(JSON.stringify(profile)),snapshot,'Roster blueprint changed');
 const record={fixture,arms:rows};if(saved)assert.deepEqual(saved.record,record,'Saved record differs');else{
  const tmp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,gzipSync(JSON.stringify({fixture,results,record}),{level:1}),{flag:'wx'});
  try{fs.linkSync(tmp,file);}finally{fs.unlinkSync(tmp);}
 }
 parentPort.postMessage({record,resumed:Boolean(saved)});
}catch(error){parentPort.postMessage({error:error.message,fixtureId:fixture.id});}});
