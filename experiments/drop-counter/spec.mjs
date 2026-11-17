import fs from'node:fs';import path from'node:path';import{root,repo,hash}from'./tools.mjs';
export const planFile=path.join(repo,'docs/drop-counter-targeted-plan-2026-11-17.json');
export const harnessFiles=['tools.mjs','spec.mjs','storage.mjs','test-storage.mjs','qualify.mjs','qualify-worker.mjs','run.mjs','worker.mjs','audit.mjs','analyze.mjs','recompute.py','../v2/runtime.mjs'];
export const harnessFingerprint=()=>hash(JSON.stringify(harnessFiles.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))])));
export const loadPlan=()=>JSON.parse(fs.readFileSync(planFile));
