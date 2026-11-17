import fs from'node:fs';import path from'node:path';import{root,repo,hash}from'./tools.mjs';
export const planFile=path.join(repo,'docs/halftime-natural-policy-plan-2026-11-17.json');
const files=['tools.mjs','spec.mjs','qualify.mjs','test-policy.mjs','audit-result.mjs','run.mjs','worker.mjs','audit.mjs','analyze.mjs','recompute.py','../drop-counter/tools.mjs','../drop-counter/storage.mjs','../v2/runtime.mjs'];
export const harnessFingerprint=()=>hash(JSON.stringify(files.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))])));
export const loadPlan=()=>JSON.parse(fs.readFileSync(planFile));
export function controls(arm,focalSide){const sides=['hold','hold'];if(arm==='focal-only')sides[focalSide]='policy';else if(arm==='opponent-only')sides[1-focalSide]='policy';else if(arm==='both')sides.fill('policy');else if(arm!=='none')throw Error('Unknown arm');return{sides};}
