import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {gunzipSync,gzipSync} from 'node:zlib';
import {labRoot,readJSON,hash,loadEngines,syntheticTeams} from './tools.mjs';
const id='hot-wet-confirm-save-resume-'+randomUUID(),dir=path.join(labRoot,'runs',id);
const file=process.argv[2]?path.resolve(process.argv[2]):path.join(labRoot,'runs',id+'-profiles.json');
if(!process.argv[2]){
 const teams=syntheticTeams(await loadEngines());fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify({schema:'century-copied-club-profiles-v1',sourceArchiveSHA256:hash(JSON.stringify(teams)),
  teamsJSONSHA256:hash(JSON.stringify(teams)),sourceSnapshotDate:'synthetic-test-only',draftPlayerMembershipChecked:false,
  selection:'Synthetic test fixtures only',profiles:[{id:'test-a',teams:teams.slice(0,2)},{id:'test-b',teams:[teams[1],teams[0]]}]}));
}
const initial=hash(fs.readFileSync(file));
const command=[path.join(labRoot,'run-streaks.mjs'),'--study-id',id,'--trials','2','--workers','2',
 '--date','2026-11-13','--arms','psychology-weather-confirm','--psychology-candidate','reduced-020','--profiles',file];
const run=()=>spawnSync(process.execPath,command,{encoding:'utf8',maxBuffer:16*1024*1024});
try{
 let r=run();assert.equal(r.status,0,r.stderr+r.stdout);
 const m=readJSON(path.join(dir,'manifest.json')),s=readJSON(path.join(dir,'summary.json'));
 assert.equal(m.arms.length,6);assert.equal(m.weatherStudy.stage,'fresh-confirmation');assert.equal(m.weatherStudy.candidate.traitModeration,.5);assert.equal(m.coefficients.scales[0],.2);assert.equal(m.coefficients.sharedPsychology.maximumOddsBonus,.006);assert.equal(s.engineResults,m.profiles.length*2*6);
 assert.equal(s.primaryContrast.caseId,'hot-wet-traits-adverse');assert.equal(s.primaryContrast.referenceId,'hot-wet-shared');
 for(const f of m.fixtures){
  const saved=JSON.parse(gunzipSync(fs.readFileSync(path.join(dir,f.id+'.json.gz')))),focal=f.swap?1:0;
  for(const [name,heat]of [['hot-wet-traits-favored',1],['hot-wet-traits-adverse',0]]){
   const input=saved.results[name].input;
   for(const p of input.teams[focal].players){assert.equal(input.weather.traits[p.id].heat,heat);assert.equal(input.weather.traits[p.id].cold,.5);}
   assert.deepEqual(input.teams[focal],m.profiles.find(p=>p.id===f.profile).teams[0]);
  }
 }
 r=run();assert.equal(r.status,0,r.stderr+r.stdout);
 assert.equal(hash(fs.readFileSync(file)),initial);
 const savedFile=path.join(dir,m.fixtures[0].id+'.json.gz'),bytes=fs.readFileSync(savedFile);
 const bad=JSON.parse(gunzipSync(bytes));bad.results['hot-wet-shared'].weatherTelemetry.extraRequestedFatigue[0]+=1;
 fs.writeFileSync(savedFile,gzipSync(JSON.stringify(bad)));r=run();assert.notEqual(r.status,0);
 assert.ok((r.stderr+r.stdout).includes('Full enabled replay failed'),'Corrupt weather telemetry must fail replay');
 fs.writeFileSync(savedFile,bytes);
 console.log(JSON.stringify({status:'passed',profiles:m.profiles.length,arms:6,fullSaveResumeResults:s.engineResults,
  immutableCopiedTeams:true,traitsFollowFocalRole:true,corruptWeatherTelemetryRejected:true}));
}finally{
 fs.rmSync(dir,{recursive:true,force:true});if(!process.argv[2])fs.rmSync(file,{force:true});
}
