// Evidence gate; directional replication does not authorize adoption.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {sourceFingerprint,hash,verifyBaseline,verifyImportBoundary,atomicJSON}from'../experiments/v2/tools.mjs';
const dir=process.argv[2];assert.ok(dir);const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n)));
const m=read('manifest.json'),audit=read('ledger-verification.json'),ind=read('independent-recomputation.json'),a=read('analysis.json');
assert.equal(m.studyId,'cold-adverse-confirmation-001');assert.equal(m.stage,'cold-confirmation');assert.equal(m.sourceSHA256,sourceFingerprint());
for(const p of [audit,ind]){assert.equal(p.status,'passed');assert.equal(p.fixtureClusters,10240);assert.equal(p.sourceSHA256,m.sourceSHA256);}
assert.equal(audit.fullOutcomesVerified,20480);assert.equal(ind.outcomes,20480);assert.equal(a.fixtureClusters,10240);assert.equal(a.outcomes,20480);
assert.equal(a.primaryContrasts.length,1);const primary=a.primaryContrasts[0];assert.equal(primary.contrast,'wet-5-adverse-035 minus wet-5');assert.equal(primary.n,10240);assert.equal(primary.familySize,1);
assert.ok(Math.abs(primary.winChangePoints-100*(primary.changedToFocal-primary.changedAgainstFocal)/10240)<1e-12);
const gate={schema:'century-cold-confirmation-gate-v1',studyId:m.studyId,confirmed:primary.winInterval[1]<0,sourceSHA256:m.sourceSHA256,
 criterion:'Fresh paired adverse-minus-mean winner conservative 95% upper endpoint below zero, full audit and independent recomputation passed.',primary,
 evidenceSHA256:Object.fromEntries(['manifest.json','ledger-verification.json','independent-recomputation.json','analysis.json','paired-outcomes.csv.gz'].map(n=>[n,hash(fs.readFileSync(path.join(dir,n)))])),
 baseline:verifyBaseline(),boundary:verifyImportBoundary(),classification:'directional-replication-only-not-coefficient-adoption'};
atomicJSON(path.join(dir,'cold-confirmation-gate.json'),gate);console.log(JSON.stringify(gate));
