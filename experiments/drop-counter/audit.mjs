import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{load,hash,readGzip,metrics,auditFull,atomicJSON}from'./tools.mjs';import{harnessFingerprint}from'./spec.mjs';import{ensureQualifiedStudyProcess,qualifyStudyRuntime}from'../v2/runtime.mjs';
ensureQualifiedStudyProcess();qualifyStudyRuntime();const e=await load({build:false}),[studyArg,prefixArg]=process.argv.slice(2),dir=path.resolve(studyArg),prefixDir=path.resolve(prefixArg),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),s=JSON.parse(fs.readFileSync(path.join(dir,'summary.json')));
assert.equal(m.sourceSHA256,e.identity.sourceSHA256);assert.equal(m.harnessSHA256,harnessFingerprint());const rows=[];let replays=0;
for(const fixture of m.fixtures){
 const record=readGzip(path.join(dir,fixture.id+'.json.gz'));assert.deepEqual(record.fixture,fixture);assert.deepEqual(record,s.records.find(r=>r.fixture.id===fixture.id));assert.equal(record.arms.length,4);
 const p=m.prefixes.find(p=>p.context===fixture.context&&p.trailingSide===fixture.trailingSide),prefixFile=path.join(prefixDir,p.file);assert.equal(hash(fs.readFileSync(prefixFile)),p.fileSHA256);const env=readGzip(prefixFile);assert.equal(hash(JSON.stringify(env.payload)),p.snapshotSHA256);
 for(const row of record.arms){
  const file=path.join(dir,row.armFile);assert.equal(hash(fs.readFileSync(file)),row.armFileSHA256);const saved=readGzip(file),result=saved.result;
  assert.equal(saved.sourceSHA256,m.sourceSHA256);assert.equal(saved.harnessSHA256,m.harnessSHA256);assert.equal(saved.prefixSourceSHA256,env.payload.sourceIdentity);assert.equal(saved.snapshotSHA256,p.snapshotSHA256);assert.deepEqual(saved.fixture,fixture);assert.equal(saved.arm,row.arm);assert.deepEqual(saved.delta,m.armDeltas[row.arm]);
  assert.equal(hash(JSON.stringify(result)),saved.resultSHA256);assert.equal(saved.resultSHA256,row.resultSHA256);assert.equal(saved.replayVerified,fixture.trial<2);if(saved.replayVerified){assert.equal(saved.replaySHA256,saved.resultSHA256);replays++;}
  assert.deepEqual(result.input,env.payload.input);assert.deepEqual(result.events.slice(0,env.payload.state.events.length),env.payload.state.events);
  const ds=result.events.filter(x=>x.type==='halftime_decision');assert.equal(ds.length,2);
  for(const side of [0,1]){const t={...result.input.teams[side].coach.tactics};if(side===fixture.trailingSide)for(const[k,v]of Object.entries(m.armDeltas[row.arm]))t[k]+=v;assert.deepEqual(ds.find(d=>d.side===side).data.effectiveTactics,t);}
  auditFull(result,e);for(const[k,v]of Object.entries(metrics(result,env,fixture.trailingSide)))assert.equal(row[k],v,'Metric differs: '+k);rows.push(row);
 }
 if(rows.length%128===0)console.log(JSON.stringify({auditedOutcomes:rows.length,total:m.fixtures.length*4}));
}
assert.equal(rows.length,m.fixtures.length*4);const keys=Object.keys(rows[0]),csv=keys.join(',')+'\n'+rows.map(r=>keys.map(k=>String(r[k])).join(',')).join('\n')+'\n';fs.writeFileSync(path.join(dir,'outcomes.csv'),csv);
atomicJSON(path.join(dir,'ledger-verification.json'),{status:'passed',sourceSHA256:m.sourceSHA256,harnessSHA256:m.harnessSHA256,fullOutcomesVerified:rows.length,fixtureClusters:m.fixtures.length,replayEvidenceOutcomes:replays,outcomesCSVSHA256:hash(csv)});console.log(JSON.stringify({status:'passed',fullOutcomesVerified:rows.length,replays}));
