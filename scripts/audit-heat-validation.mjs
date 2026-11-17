// Full retained-ledger audit and compact export; no resimulation or official writes.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gunzipSync,gzipSync} from 'node:zlib';
import {loadEngines,readJSON,hash,auditResult,verifyBaseline,verifyImportBoundary,sourceFingerprint,atomicJSON} from '../experiments/v2/tools.mjs';
import {HEAT_ARMS,heatInput} from '../experiments/v2/heat-fixtures.mjs';
const [dir,out]=process.argv.slice(2);assert.ok(dir&&out);fs.mkdirSync(out,{recursive:true});
const m=readJSON(path.join(dir,'manifest.json')),s=readJSON(path.join(dir,'summary.json'));assert.equal(s.status,'completed');assert.equal(m.sourceSHA256,sourceFingerprint());
assert.equal(s.sourceSHA256,m.sourceSHA256);assert.equal(m.fixtures.length,3200);assert.equal(s.records.length,3200);assert.equal(s.engineResults,6400);
const e=await loadEngines(),headers=['fixture','profile','pairId','trial','swapped','arm','focalWin','focalScore','opponentScore','playingSeconds','focalShots','opponentShots','focalMeanFinalEnergy','opponentMeanFinalEnergy','weatherJSON','resultSHA256'];
const csv=[headers.join(',')],index=[];const quote=v=>'"'+String(v).replaceAll('"','""')+'"';let results=0;
for(let i=0;i<m.fixtures.length;i++){
 const f=m.fixtures[i],p=m.profiles.find(p=>p.id===f.profile),file=path.join(dir,f.id+'.json.gz'),bytes=fs.readFileSync(file),saved=JSON.parse(gunzipSync(bytes));
 assert.deepEqual(saved.fixture,f);assert.deepEqual(saved.record,s.records[i]);assert.deepEqual(Object.keys(saved.results).sort(),['hot','temperate']);assert.equal(saved.record.arms.length,2);
 for(const arm of HEAT_ARMS){
  const r=saved.results[arm.id],row=saved.record.arms.find(a=>a.id===arm.id),side=Number(f.swap),input=heatInput(e,p,f,arm);
  assert.deepEqual(r.input,input);assert.equal(r.engineVersion,'2.0.0-lab');auditResult(r,e);assert.equal(hash(JSON.stringify(r)),row.resultSHA256);
  const final=r.events.at(-1).data.finalCondition,energy=side=>final.filter(x=>input.teams[side].players.some(p=>p.id===x.playerId)).reduce((a,p)=>a+p.energy,0)/35;
  const reconstructed={id:arm.id,focalWin:Number(r.winner===side),focalScore:r.scores[side],opponentScore:r.scores[1-side],playingSeconds:r.playingSeconds,
   focalShots:r.teamStats[side].shots,opponentShots:r.teamStats[1-side].shots,focalMeanFinalEnergy:energy(side),opponentMeanFinalEnergy:energy(1-side),weather:r.weatherTelemetry,resultSHA256:row.resultSHA256};
  assert.deepEqual(row,reconstructed);const values=[f.id,f.profile,p.pairId,f.trial,f.swap,arm.id,...headers.slice(6,14).map(k=>row[k]),JSON.stringify(row.weather),row.resultSHA256];
  csv.push(values.map(quote).join(','));results++;
 }
 index.push({fixture:f.id,file:path.basename(file),bytes:bytes.length,sha256:hash(bytes)});
 if((i+1)%100===0)console.log(JSON.stringify({verifiedFixtures:i+1,totalFixtures:3200,outcomesVerified:results}));
}
fs.writeFileSync(path.join(out,'paired-outcomes.csv.gz'),gzipSync(csv.join('\n')+'\n',{level:9}));atomicJSON(path.join(out,'ledger-checksums.json'),index);
const proof={status:'passed',fixtureClusters:index.length,fullOutcomesVerified:results,gzipCRCVerified:true,allResultSHA256Verified:true,
 allSavedInputsAndCompactMetricsVerified:true,allScoringStatisticsAndClocksVerified:true,sourceSHA256:sourceFingerprint(),baseline:verifyBaseline(),boundary:verifyImportBoundary()};
atomicJSON(path.join(out,'ledger-verification.json'),proof);console.log(JSON.stringify(proof));
