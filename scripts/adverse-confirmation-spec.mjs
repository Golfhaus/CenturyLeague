import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{fileURLToPath}from'node:url';
import{hash,readJSON}from'../experiments/v2/tools.mjs';import{BROAD_ARMS,broadInput}from'./broad-modifier-spec.mjs';import{PINNED_QUALITY_FILES,qualityHarnessFingerprint,readSelection}from'./quality-gap-spec.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const adverseInput=broadInput;
export const adverseArms=cohort=>{assert.ok(['matched','stronger'].includes(cohort));return BROAD_ARMS.filter(a=>['control','psych-adverse',...(cohort==='matched'?['hot-combined-adverse']:[])].includes(a.id));};
export const PINNED_ADVERSE_FILES=[...new Set([...PINNED_QUALITY_FILES,'scripts/broad-modifier-spec.mjs','scripts/adverse-confirmation-spec.mjs','scripts/run-adverse-confirmation.mjs','scripts/adverse-confirmation-worker.mjs','scripts/audit-adverse-confirmation.mjs','scripts/validate-adverse-confirmation.mjs','scripts/analyze-adverse-confirmation.py','scripts/recompute-adverse-confirmation.py','docs/ADVERSE_MODIFIER_CONFIRMATION_PLAN_2026_11_16.md'])];
export const adverseHarnessFingerprint=()=>hash(JSON.stringify(PINNED_ADVERSE_FILES.map(f=>[f,hash(fs.readFileSync(path.join(repo,f)))])));
export function verifyAdverseScreen(dir,source,profileBytes){
 const g=readSelection(path.join(dir,'controls/selection.json'),'adverse-screen-check',source,qualityHarnessFingerprint());assert.equal(g.selectedMagnitude,.1);
 const p=path.join(dir,'modifiers'),m=readJSON(path.join(p,'manifest.json')),a=readJSON(path.join(p,'analysis.json')),v=readJSON(path.join(p,'ledger-verification.json')),i=readJSON(path.join(p,'independent-recomputation.json'));
 assert.equal(m.studyId,'moderate-quality-modifier-validation-001');assert.equal(a.status,'completed');assert.equal(v.status,'passed');assert.equal(i.status,'passed');assert.equal(v.fullOutcomesVerified,20736);assert.equal(i.outcomes,20736);
 for(const x of[m,a,v,i]){assert.equal(x.sourceSHA256,source);assert.equal(x.harnessSHA256,qualityHarnessFingerprint());}
 assert.equal(m.profileFileSHA256,hash(profileBytes));assert.equal(i.analysisSHA256,hash(fs.readFileSync(path.join(p,'analysis.json'))));
 for(const x of[v,i]){assert.equal(x.manifestSHA256,hash(fs.readFileSync(path.join(p,'manifest.json'))));assert.equal(x.compactOutcomesSHA256,hash(fs.readFileSync(path.join(p,'paired-outcomes.csv.gz'))));}
 return{studyId:m.studyId,selectedMagnitude:g.selectedMagnitude,evidenceSHA256:Object.fromEntries(['controls/selection.json','controls/selection-verification.json','modifiers/manifest.json','modifiers/analysis.json','modifiers/ledger-verification.json','modifiers/independent-recomputation.json','modifiers/paired-outcomes.csv.gz'].map(f=>[f,hash(fs.readFileSync(path.join(dir,f)))]))};
}
