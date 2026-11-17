// Full retained-ledger audit and compact export; no resimulation or official writes.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gunzipSync,gzipSync} from 'node:zlib';
import {loadEngines,readJSON,hash,auditResult,verifyBaseline,verifyImportBoundary,sourceFingerprint,atomicJSON} from '../experiments/v2/tools.mjs';
import {stageInput,stageRow} from '../experiments/v2/modifier-stage-fixtures.mjs';
import {qualityArms,qualityHarnessFingerprint,qualityInput} from './quality-gap-spec.mjs';
const [dir,out]=process.argv.slice(2);assert.ok(dir&&out);fs.mkdirSync(out,{recursive:true});
const m=readJSON(path.join(dir,'manifest.json')),s=readJSON(path.join(dir,'summary.json'));assert.equal(s.status,'completed');assert.equal(m.sourceSHA256,sourceFingerprint());
const arms=qualityArms(m.stage),expected=m.studyId.startsWith('quality-preflight-')?36:m.stage==='controls'?5632:2304;assert.equal(m.harnessSHA256,qualityHarnessFingerprint());
assert.equal(s.sourceSHA256,m.sourceSHA256);assert.equal(m.fixtures.length,expected);assert.equal(s.records.length,expected);assert.equal(s.engineResults,expected*arms.length);assert.deepEqual(m.arms,arms);
const e=await loadEngines(),headers=['fixture','profile','pairId','trial','swapped','arm','focalWin','focalScore','opponentScore','playingSeconds','focalShots','opponentShots','focalMeanFinalEnergy','opponentMeanFinalEnergy','weatherJSON','resultSHA256','labJSON'];
const csv=[headers.join(',')],index=[];const quote=v=>'"'+String(v).replaceAll('"','""')+'"';let results=0;
for(let i=0;i<m.fixtures.length;i++){
 const f=m.fixtures[i],p=m.profiles.find(p=>p.id===f.profile),file=path.join(dir,f.id+'.json.gz'),bytes=fs.readFileSync(file),saved=JSON.parse(gunzipSync(bytes));
 assert.deepEqual(saved.fixture,f);assert.deepEqual(saved.record,s.records[i]);assert.deepEqual(Object.keys(saved.results).sort(),arms.map(a=>a.id).sort());assert.equal(saved.record.arms.length,arms.length);
 for(const arm of arms){
  const r=saved.results[arm.id],row=saved.record.arms.find(a=>a.id===arm.id),side=Number(f.swap),input=qualityInput(e,p,f,arm);
  assert.deepEqual(r.input,input);assert.equal(r.engineVersion,'2.0.0-lab');auditResult(r,e);assert.equal(hash(JSON.stringify(r)),row.resultSHA256);
  const t=r.labTelemetry;assert.equal(t.severity.reduce((a,c)=>a+c.opportunities,0),r.events.filter(x=>x.type==='foul').length);
  assert.equal(t.severity.reduce((a,c)=>a+c.successes,0),r.events.filter(x=>x.type==='foul'&&x.data.serious).length);
  for(const c of t.psychology?.contributions??[])assert.ok(c.appliedOddsBonus<=input.lab.psychology.maximumOddsBonus+1e-12);
  const reconstructed={...stageRow(r,input,f,arm),resultSHA256:row.resultSHA256};
  assert.deepEqual(row,reconstructed);const values=[f.id,f.profile,p.pairId,f.trial,f.swap,arm.id,...headers.slice(6,14).map(k=>row[k]),JSON.stringify(row.weather),row.resultSHA256,JSON.stringify(row.lab)];
  csv.push(values.map(quote).join(','));results++;
 }
 index.push({fixture:f.id,file:path.basename(file),bytes:bytes.length,sha256:hash(bytes)});
 if((i+1)%100===0)console.log(JSON.stringify({verifiedFixtures:i+1,totalFixtures:expected,outcomesVerified:results}));
}
fs.copyFileSync(path.join(dir,'manifest.json'),path.join(out,'manifest.json'));
fs.writeFileSync(path.join(out,'paired-outcomes.csv.gz'),gzipSync(csv.join('\n')+'\n',{level:9}));atomicJSON(path.join(out,'ledger-checksums.json'),index);
const proof={status:'passed',compactOutcomesSHA256:hash(fs.readFileSync(path.join(out,'paired-outcomes.csv.gz'))),manifestSHA256:hash(fs.readFileSync(path.join(out,'manifest.json'))),harnessSHA256:m.harnessSHA256,stage:m.stage,studyId:m.studyId,fullLabTelemetryAndCapVerified:true,fixtureClusters:index.length,fullOutcomesVerified:results,gzipCRCVerified:true,allResultSHA256Verified:true,
 allSavedInputsAndCompactMetricsVerified:true,allScoringStatisticsAndClocksVerified:true,sourceSHA256:sourceFingerprint(),baseline:verifyBaseline(),boundary:verifyImportBoundary()};
atomicJSON(path.join(out,'ledger-verification.json'),proof);console.log(JSON.stringify(proof));
