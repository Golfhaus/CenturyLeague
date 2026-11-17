import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{fileURLToPath}from'node:url';
import {COMBINED_ARMS}from'../experiments/v2/modifier-stage-fixtures.mjs';import{hash,readJSON}from'../experiments/v2/tools.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const HOT_ARMS=COMBINED_ARMS.filter(a=>['control','hot-combined-favored'].includes(a.id));
export const PINNED_HARNESS_FILES=['scripts/hot-favored-confirmation-spec.mjs','scripts/run-hot-favored-confirmation.mjs','scripts/hot-favored-confirmation-worker.mjs','scripts/validate-hot-favored-confirmation.mjs','scripts/audit-hot-favored-confirmation.mjs','scripts/analyze-hot-favored-confirmation.py','scripts/recompute-hot-favored-confirmation.py','docs/HOT_FAVORED_COMBINED_CONFIRMATION_PLAN_2026_11_15.md'];
export function hotHarnessFingerprint(){return hash(JSON.stringify(PINNED_HARNESS_FILES.map(f=>[f,hash(fs.readFileSync(path.join(repo,f)))])));}
export function verifyScreen(dir,source,profilesSHA256){
 assert.ok(dir,'A completed prior screen is required');const m=readJSON(path.join(dir,'manifest.json')),a=readJSON(path.join(dir,'analysis.json')),v=readJSON(path.join(dir,'ledger-verification.json')),i=readJSON(path.join(dir,'independent-recomputation.json'));
 assert.equal(m.studyId,'copied-club-combined-modifiers-001');assert.equal(m.sourceSHA256,source);assert.equal(m.profilesSHA256,profilesSHA256);
 for(const p of [a,v,i]){assert.equal(p.status,'passed'===p.status?'passed':'completed');assert.equal(p.sourceSHA256,source);}
 assert.equal(v.status,'passed');assert.equal(i.status,'passed');assert.equal(v.fullOutcomesVerified,11264);assert.equal(i.outcomes,11264);assert.equal(a.fixtureClusters,1024);
 assert.equal(a.primaryContrasts[0].contrast,'hot-combined-favored minus control');
 return {studyId:m.studyId,sourceSHA256:source,evidenceSHA256:Object.fromEntries(['manifest.json','analysis.json','ledger-verification.json','independent-recomputation.json'].map(f=>[f,hash(fs.readFileSync(path.join(dir,f)))]))};
}
