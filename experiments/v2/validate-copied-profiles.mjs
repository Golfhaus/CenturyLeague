import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {labRoot,hash,readJSON,loadEngines,syntheticTeams} from './tools.mjs';
const id=`copied-profile-validation-${randomUUID()}`;
const dir=path.join(labRoot,'runs',id);
const inputFile=process.argv[2]?path.resolve(process.argv[2]):path.join(labRoot,'runs',id+'-profiles.json');
if(!process.argv[2]){
 const teams=syntheticTeams(await loadEngines());
 fs.writeFileSync(inputFile,JSON.stringify({schema:'century-copied-club-profiles-v1',
  sourceArchiveSHA256:hash(JSON.stringify(teams)),teamsJSONSHA256:hash(JSON.stringify(teams)),
  sourceSnapshotDate:'synthetic-ci-fixture',draftPlayerMembershipChecked:false,
  selection:'Synthetic CI profiles only, not real-club validation data.',profiles:[
  {id:'copied-a',teams:teams.slice(0,2)},{id:'copied-b',teams:[teams[1],teams[0]]}]}));
}
const before=hash(fs.readFileSync(inputFile));
const args=[path.join(labRoot,'run-streaks.mjs'),'--study-id',id,'--trials','2','--workers','2',
 '--date','2026-11-13','--arms','psychology-validation','--psychology-candidate','reduced-020','--profiles',inputFile];
const run=()=>spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:8*1024*1024});
try{
 let r=run();assert.equal(r.status,0,r.stderr+r.stdout);
 const m=readJSON(path.join(dir,'manifest.json')),s=readJSON(path.join(dir,'summary.json'));
 const original=readJSON(inputFile);
 assert.deepEqual(m.profiles,original.profiles);
 assert.equal(s.engineResults,m.profiles.length*2*5);
 assert.equal(m.copiedProfiles.fileSHA256,before);
 assert.equal(s.coefficients.scales[0],.20);
 assert.equal(s.coefficients.sharedPsychology.maximumOddsBonus,.006);
 for(const f of m.fixtures){
  const saved=JSON.parse(gunzipSync(fs.readFileSync(path.join(dir,f.id+'.json.gz'))));
  const focal=f.swap?1:0,opposing=1-focal;
  for(const [arm,result]of Object.entries(saved.results)){
   assert.deepEqual(result.input.teams[focal],m.profiles.find(p=>p.id===f.profile).teams[0]);
   if(arm==='shared-adverse-5'){
    assert.equal(result.input.lab.psychology.homeSide,opposing);
    assert.deepEqual([result.input.lab.streaks[focal],result.input.lab.streaks[opposing]],[-5,5]);
   }
  }
 }
 r=run();assert.equal(r.status,0,r.stderr+r.stdout);
 assert.equal(hash(fs.readFileSync(inputFile)),before);
 const file=path.join(dir,m.fixtures[0].id+'.json.gz'),savedBytes=fs.readFileSync(file);
 const corrupt=JSON.parse(gunzipSync(savedBytes));corrupt.results.control.playingSeconds+=1;
 fs.writeFileSync(file,gzipSync(JSON.stringify(corrupt)));
 r=run();assert.notEqual(r.status,0,'Corrupt saved ledger must stop resumption');
 assert.ok((r.stderr+r.stdout).includes('Root playing clock differs'));
 fs.writeFileSync(file,savedBytes);
 console.log(JSON.stringify({status:'passed',profiles:m.profiles.length,fullSaveResumeResults:s.engineResults,
  copiedTeamsUnchanged:true,bothSimulationSides:true,adverseVenueAndStreakMapping:true,corruptLedgerRejected:true}));
}finally{
 fs.rmSync(dir,{recursive:true,force:true});
 if(!process.argv[2])fs.rmSync(inputFile,{force:true});
}
