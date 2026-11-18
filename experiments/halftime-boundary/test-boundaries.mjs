import fs from 'node:fs';import assert from 'node:assert/strict';import {load,atomicJSON,hash} from './tools.mjs';
const previous=await (await import('../halftime-policy/tools.mjs')).load({build:false});const e=await load({build:false}),proof=JSON.parse(fs.readFileSync(process.argv[2]));let checked=0;
for(const probe of proof.probes){const o=probe.observation,before=hash(JSON.stringify(o)),d=e.decideHalftime(o,'policy'),recipe=probe.decision.choice.startsWith('lower-aerial')?'lower-aerial':'aerial';
 const blocked=d.candidates.filter(c=>c.recipe===recipe);assert.ok(blocked.length);for(const c of blocked){assert.equal(c.responseGain,0);assert.equal(c.estimatedBenefit,0);assert.equal(c.veto,'primary-lever-at-bound');assert.equal(c.admissible,false);checked++;}
 assert.ok(!d.choice.startsWith(recipe+'-'));assert.equal(hash(JSON.stringify(o)),before);
 for(const mode of ['aligned-diagnostic','mismatched-diagnostic']){const x=e.decideHalftime(o,mode);assert.ok(!x.choice.startsWith(recipe+'-'));checked++;}
 const partial=structuredClone(o);partial.root.aerial_emphasis=recipe==='aerial'?4.75:1.25;const pd=e.decideHalftime(partial,'policy');
 for(const c of pd.candidates.filter(c=>c.recipe===recipe)){assert.ok(Math.abs(c.tactics.aerial_emphasis-partial.root.aerial_emphasis-.25*(recipe==='aerial'?1:-1))<1e-12);assert.ok(Math.abs(c.responseGain-.325)<1e-12);assert.ok(Math.abs(c.estimatedBenefit-c.evidence*.325)<1e-12);checked++;}
 const interior=structuredClone(o);interior.root.aerial_emphasis=3;const id=e.decideHalftime(interior,'policy');const old=previous.decideHalftime(interior,'policy');assert.equal(id.choice,old.choice);assert.deepEqual(id.effectiveTactics,old.effectiveTactics);checked++;
}
atomicJSON(process.argv[3],{status:'passed',sourceSHA256:e.identity.sourceSHA256,checks:checked,scope:['Both aerial bounds','Zero benefit when primary lever cannot move','Structural veto applies in diagnostics','Partially clipped primary movement scales response','Interior-root decision preserved','Observation immutability'],fullPerformanceValidation:false},true);console.log(JSON.stringify({status:'passed',checks:checked,sourceSHA256:e.identity.sourceSHA256}));
