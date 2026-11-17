import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';import {gunzipSync,gzipSync} from 'node:zlib';
import {loadEngines,hash,readJSON,labRoot,verifyBaseline,sportingJSON} from './tools.mjs';import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from './runtime.mjs';
import {COLD_ARMS,coldInput} from './cold-fixtures.mjs';import {confirmationArms,confirmationInput} from './temperature-confirmation-fixtures.mjs';
ensureQualifiedStudyProcess();qualifyStudyRuntime();const e=await loadEngines(),file=process.argv[2],historical=readJSON(process.argv[3]);
const profiles=readJSON(file).profiles.filter(p=>/^pair-[1-4]-focal-0$/.test(p.id)),snapshot=hash(JSON.stringify(profiles));assert.equal(profiles.length,4);
const parity=r=>{const c=structuredClone(r);delete c.weatherTelemetry;delete c.labTelemetry;delete c.input.weather;return sportingJSON(c);};
let constructionChecks=0,neutralTraitReplays=0,legacyReplays=0,heldStateChecks=0;
for(const profile of profiles)for(const swap of [false,true]){
 const f={id:'cold-contract',seed:'cold-contract',swap},normalMaps=[];
 for(const arm of COLD_ARMS){
  const input=coldInput(e,profile,f,arm),side=Number(swap),w=input.weather,c=w.conditions;assert.deepEqual(input.teams[side],profile.teams[0]);assert.deepEqual(input.teams[1-side],profile.teams[1]);assert.deepEqual(input.lab.enabled,[]);
  assert.equal(c.relativeHumidity,90);assert.equal(c.windKmh,arm.wet?35:0);assert.equal(c.rainMmPerHour,arm.wet?5:0);assert.equal(c.temperatureC,arm.temperatureC);assert.equal(e.weatherLoads(w).heat,0);
  for(let s=0;s<2;s++)for(const p of input.teams[s].players){
   const load=Math.min(1,Math.max(0,(10-c.temperatureC)/15))*(arm.wet?1.4:1),t=w.traits?.[p.id]?.cold??.5,moderation=arm.thermalCandidate==='reduced-035'?.35:.5,v=e.thermalMultipliers(w,p.id);
   assert.ok(Math.abs(v.fatigue-(1+.06*load*(1-moderation*(t-.5))))<1e-12);assert.ok(Math.abs(v.recovery-(1-.02*load*(1-moderation*(t-.5))))<1e-12);
   if(arm.traits==='focal-favored'||arm.traits==='opponent-favored'){const favored=arm.traits==='focal-favored'?s===side:s!==side;assert.deepEqual(w.traits[p.id],{heat:.5,cold:Number(favored)});}
   if(w.traits){const changed=structuredClone(w);changed.traits[p.id].heat=1-changed.traits[p.id].heat;assert.deepEqual(e.thermalMultipliers(changed,p.id),v);}
   heldStateChecks++;
  }
  if(arm.traits==='normal')normalMaps.push(w.traits);constructionChecks++;
 }
 assert.deepEqual(normalMaps[0],normalMaps[1]);assert.ok(Object.values(normalMaps[0]).some(t=>t.heat!==t.cold));
 for(const wet of [false,true]){
  const neutral=COLD_ARMS.find(a=>a.id===(wet?'wet18':'dry18')),mean=coldInput(e,profile,f,neutral),normal=coldInput(e,profile,f,{...neutral,traits:'normal',thermalCandidate:'reduced-035'});
  assert.equal(hash(parity(e.simulateV2(mean))),hash(parity(e.simulateV2(normal))));neutralTraitReplays++;
 }
}
for(const wet of [false,true])for(const t of [18,10.000001,10,9.999999,4,0,-4.999999,-5]){
 const input=coldInput(e,profiles[0],{id:'cold-threshold',seed:'cold-threshold',swap:false},{temperatureC:t,wet,traits:'none'}),w=input.weather;
 const neutral=coldInput(e,profiles[0],{id:'cold-threshold',seed:'cold-threshold',swap:false},{temperatureC:18,wet,traits:'none'}).weather;
 assert.equal(e.weatherProbability(.7,w,0,1,'kick'),e.weatherProbability(.7,neutral,0,1,'kick'));assert.equal(e.weatherMovement(w),e.weatherMovement(neutral));
 if(t>=10)assert.deepEqual(e.thermalMultipliers(w,'unused'),{fatigue:1,recovery:1});
}
for(const target of historical.targets){
 const profile=historical.manifest.profiles.find(p=>p.id===target.fixture.profile);
 for(const arm of confirmationArms(target.fixture)){assert.equal(hash(JSON.stringify(e.simulateV2(confirmationInput(e,profile,target.fixture,arm)))),target.hashes[arm.id]);legacyReplays++;}
}
const id='cold-preflight-'+randomUUID(),dir=path.join(labRoot,'runs',id),args=[path.join(labRoot,'run-cold-validation.mjs'),'--study-id',id,'--trials','2','--workers','8','--profiles',file];
const run=()=>spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:16*1024*1024});
try{
 let r=run();assert.equal(r.status,0,r.stderr+r.stdout);const m=readJSON(path.join(dir,'manifest.json')),s=readJSON(path.join(dir,'summary.json'));assert.equal(s.engineResults,96);
 r=run();assert.equal(r.status,0,r.stderr+r.stdout);const q=path.join(dir,m.fixtures[0].id+'.json.gz'),bytes=fs.readFileSync(q),bad=JSON.parse(gunzipSync(bytes));bad.results['wet-5-adverse-035'].weatherTelemetry.energySeconds[0]+=1;
 fs.writeFileSync(q,gzipSync(JSON.stringify(bad)));r=run();assert.notEqual(r.status,0);assert.ok((r.stderr+r.stdout).includes('Full enabled replay failed'));fs.writeFileSync(q,bytes);assert.equal(hash(JSON.stringify(profiles)),snapshot);
 console.log(JSON.stringify({status:'passed',constructionChecks,neutralTraitReplays,legacyResultsExactlyReplayed:legacyReplays,heldStateChecks,saveResumeOutcomes:96,heatTraitInactive:true,directWeatherPenaltyTemperatureIndependent:true,corruptTelemetryRejected:true,rostersAndTacticsImmutable:true,baseline:verifyBaseline()}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
