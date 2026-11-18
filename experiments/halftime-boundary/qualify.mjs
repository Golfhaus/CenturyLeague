import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import zlib from'node:zlib';
import{load,root,repo,hash,atomicJSON,inputFor,auditPhysical,stripDecisionEvents}from'./tools.mjs';import{ensureQualifiedStudyProcess,qualifyStudyRuntime}from'../v2/runtime.mjs';
ensureQualifiedStudyProcess();const runtime=qualifyStudyRuntime(),[prefixArg,profileArg,outArg]=process.argv.slice(2);assert.ok(prefixArg&&profileArg&&outArg);
const e=await load(),prefixDir=path.resolve(prefixArg),out=path.resolve(outArg);assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const pm=JSON.parse(fs.readFileSync(path.join(prefixDir,'prefix-manifest.json'))),profiles=JSON.parse(fs.readFileSync(profileArg)).profiles;
let legacyPolicyDecisions=0,legacyDiagnosticDecisions=0;
for(const p of pm.records){
 const file=path.join(prefixDir,p.file);assert.equal(hash(fs.readFileSync(file)),p.fileSHA256);const env=JSON.parse(zlib.gunzipSync(fs.readFileSync(file))),s=env.payload.state,totals=e.publicTotals(s.events.slice(0,s.halftimePrefixLength));assert.equal(hash(JSON.stringify(env.payload)),env.sha256);
 const observations=[0,1].map(side=>({side,scores:s.score.scores,root:env.payload.input.teams[side].coach.tactics,ownOnField:s.players.filter(p=>p.side===side&&p.on).map(p=>({id:p.id,energy:p.energy,ratings:p.ratings})),ownBeforeInterval:s.beforeInterval[side],publicTotals:totals,personnelReview:s.personnelReview[side]}));
 for(const side of [0,1]){const before=hash(JSON.stringify(observations[side])),d=e.decideHalftime(observations[side],'policy');assert.equal(d.choice,p.decisions[side].choice);assert.equal(d.rootDistance,p.decisions[side].rootDistance);assert.equal(hash(JSON.stringify(observations[side])),before);legacyPolicyDecisions++;
  for(const c of d.candidates){assert.ok(c.rootDistance<=2&&c.changedSliders<=2);assert.ok(Object.values(c.tactics).every(x=>x>=1&&x<=5));}
 }
 for(const [mode,expected]of [['aligned-diagnostic',p.alignedChoice],['mismatched-diagnostic',p.mismatchedChoice]]){const d=e.decideHalftime(observations[p.trailingSide],mode);assert.equal(d.choice,expected);assert.equal(d.diagnosticAvailable,p.diagnosticAvailable);legacyDiagnosticDecisions++;}
}
let defaultOff=0,holdEquivalence=0,enabledReplays=0,firstHalfInvariance=0;
const cases=profiles.filter(p=>[-.35,0,.35].includes(p.gap)).filter((p,i)=>i%2===0).slice(0,6);
for(const p of cases){
 const input=inputFor(e,p.teams,'policy-qualification-'+p.id,'halftime-boundary-qualification-only:'+p.id,'2026-11-17');
 const off=e.simulate(input),native=e.simulateV2(input);assert.deepEqual(off,native);defaultOff++;
 const hold=e.simulate({...input,halftime:{sides:['hold','hold']}});auditPhysical(hold,e);assert.deepEqual(stripDecisionEvents(hold),stripDecisionEvents(native));holdEquivalence++;
 const on=e.simulate({...input,halftime:{sides:['policy','policy']}});assert.deepEqual(on,e.simulate({...input,halftime:{sides:['policy','policy']}}));auditPhysical(on,e);enabledReplays++;
 const prefix=r=>r.events.slice(0,r.events.findIndex(x=>x.type==='quarter_end'&&x.quarter===2)+1);assert.deepEqual(prefix(on),prefix(hold));firstHalfInvariance++;
 for(const d of on.halftimeTelemetry.decisions){assert.equal(d.policyVersion,e.POLICY_VERSION);assert.ok(d.rootDistance<=2);assert.deepEqual(d,e.decideHalftime(d.observation,'policy'));assert.equal(d.observation.side,d.side);}
 atomicJSON(path.join(out,'progress.json'),{defaultOff,holdEquivalence,enabledReplays});
}
for(const settings of [{sides:['policy']},{sides:['unknown','hold']},{sides:['hold','hold'],futureWinner:0}])assert.throws(()=>e.validateSettings(settings));
atomicJSON(path.join(out,'qualification.json'),{status:'passed',source:e.identity,runtime,legacyPolicyDecisions,legacyDiagnosticDecisions,defaultOffComparisons:defaultOff,holdEquivalenceComparisons:holdEquivalence,enabledExactReplays:enabledReplays,firstHalfInvariance,invalidSettingsRejected:3,
 semantics:'Boundary correction only: blocked aerial recipes are inadmissible and aerial response scales with actual directional movement; other coefficients and thresholds unchanged. Historical interior-root decisions are regression evidence, not new sporting validation.',scientificValidationOutcomesGenerated:0});
console.log(JSON.stringify({status:'passed',legacyPolicyDecisions,legacyDiagnosticDecisions,defaultOff,holdEquivalence,enabledReplays,firstHalfInvariance,sourceSHA256:e.identity.sourceSHA256}));
