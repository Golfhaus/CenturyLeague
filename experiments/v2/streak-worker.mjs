import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { parentPort, workerData } from 'node:worker_threads';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEngines, inputFor, hash, sportingJSON, auditResult, atomicJSON } from './tools.mjs';
const e=await loadEngines(false);
if(workerData.requiredExecArgv)assert.deepEqual(process.execArgv,workerData.requiredExecArgv,'Worker did not inherit qualified runtime flags');
const withoutTelemetry=r=>{const {labTelemetry,...rest}=r;return sportingJSON(rest);};
parentPort.on('message',fixture=>{
  try {
    const profile=workerData.profiles.find(p=>p.id===fixture.profile);
    const teams=fixture.swap?[profile.teams[1],profile.teams[0]]:profile.teams;
    const focalSide=fixture.swap?1:0,opposingSide=1-focalSide;
    const base=inputFor(e,teams,fixture.id,fixture.seed,workerData.matchDate);
    const snapshot=JSON.stringify(base);
    const file=path.join(workerData.dir,`${fixture.id}.json.gz`);
    let saved=null;
    if(fs.existsSync(file))saved=JSON.parse(gunzipSync(fs.readFileSync(file)));
    if(saved)assert.deepEqual(saved.fixture,fixture);
    const results={},arms=[];
    for(const arm of workerData.arms) {
      const streaks=[0,0];streaks[focalSide]=arm.focal;streaks[opposingSide]=arm.opponent;
      const input={...structuredClone(base),lab:{enabled:arm.enabled,streaks,confidenceScale:workerData.confidenceScale??1,frustrationScale:1,...(workerData.sharedPolicy?{psychology:{...workerData.sharedPolicy,homeSide:arm.home==='focal'?focalSide:arm.home==='opponent'?opposingSide:null}}:{})}};
      // The public engine now owns the snapshot boundary; this caller retains its
      // direct return value so regressions cannot be masked by a second clone.
      const result=saved?saved.results[arm.id]:e.simulateV2(input);
      Object.freeze(result);
      assert.ok(result && result.engineVersion==='2.0.0-lab');
      assert.equal(hash(JSON.stringify(result.input)),hash(JSON.stringify(input)),'Saved input differs');
      auditResult(result,e);
      // Fresh studies replay a prespecified first fixture per profile/arm. Resumption verifies every saved result.
      if(saved||fixture.trial===0)assert.equal(hash(JSON.stringify(e.simulateV2(input))),hash(JSON.stringify(result)),'Full enabled replay failed');
      if(fixture.trial===0&&arm.id==='control')assert.equal(hash(withoutTelemetry(result)),hash(withoutTelemetry(e.simulateV1(input))),'Control differs from frozen v1.0');
      const t=result.labTelemetry;
      assert.equal(t.severity.reduce((s,c)=>s+c.opportunities,0),result.events.filter(x=>x.type==='foul').length);
      assert.equal(t.severity.reduce((s,c)=>s+c.successes,0),result.events.filter(x=>x.type==='foul'&&x.data.serious).length);
      results[arm.id]=result;
      arms.push({id:arm.id,focalWin:Number(result.winner===focalSide),focalScore:result.scores[focalSide],opponentScore:result.scores[opposingSide],
        playingSeconds:result.playingSeconds,contacts:t.contacts[focalSide],foulOpportunities:t.severity[focalSide].opportunities,
        seriousFouls:t.severity[focalSide].successes,opponentFoulOpportunities:t.severity[opposingSide].opportunities,
        opponentSeriousFouls:t.severity[opposingSide].successes,
        baselineSeverityProbabilitySum:t.severity[focalSide].baselineProbabilitySum,
        adjustedSeverityProbabilitySum:t.severity[focalSide].adjustedProbabilitySum,
        severityThresholdChanges:t.severity.reduce((s,c)=>s+c.immediateOutcomesChanged,0),
        confidenceChecks:Object.values(t.confidence).flat().reduce((s,c)=>s+c.opportunities,0),
        confidenceThresholdChanges:Object.values(t.confidence).flat().reduce((s,c)=>s+c.immediateOutcomesChanged,0),
        ...(t.psychology?{psychologyContributions:t.psychology.contributions,homeSide:input.lab.psychology.homeSide}:{}),
        confidenceProbabilityShiftSum:Object.values(t.confidence).flat().reduce((s,c)=>s+c.adjustedProbabilitySum-c.baselineProbabilitySum,0),
        resultSHA256:hash(JSON.stringify(result))});
    }
    for(const [id,result] of Object.entries(results)) {
      auditResult(result,e);
      assert.equal(hash(JSON.stringify(result)),arms.find(arm=>arm.id===id).resultSHA256,'Retained result changed after a later simulation');
    }
    if(results['home-losing-5']) {
      const sporting = r => JSON.stringify({events:r.events,scores:r.scores,quarters:r.quarters,players:r.players,teamStats:r.teamStats,playingSeconds:r.playingSeconds,elapsedSeconds:r.elapsedSeconds});
      assert.equal(hash(sporting(results['control'])),hash(sporting(results['home-losing-5'])),'Losing home support failed exact neutralization');
    }
    for(const r of Object.values(results))for(const c of r.labTelemetry.psychology?.contributions??[])
      assert.ok(c.appliedOddsBonus<=r.input.lab.psychology.maximumOddsBonus,'Shared psychological cap exceeded');
    assert.equal(JSON.stringify(base),snapshot,'Copied input mutated');
    const record={fixture,arms};
    if(saved)assert.deepEqual(saved.record,record,'Saved summary differs');
    else {
      const bytes=gzipSync(JSON.stringify({fixture,results,record}),{level:1});
      const temporary=file+`.${randomUUID()}.tmp`;
      fs.writeFileSync(temporary,bytes,{flag:'wx'});
      try{fs.linkSync(temporary,file);}finally{fs.unlinkSync(temporary);}
    }
    parentPort.postMessage({record,resumed:Boolean(saved)});
  }catch(error){parentPort.postMessage({error:error.message,fixtureId:fixture.id});}
});
