import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from './runtime.mjs';
import {loadEngines,syntheticTeams,inputFor,sportingJSON,auditResult,hash,verifyBaseline} from './tools.mjs';
import {FIXED_WEATHER,WEATHER_ARMS,weatherForArm} from './weather-fixtures.mjs';
ensureQualifiedStudyProcess();const runtime=qualifyStudyRuntime();
const e=await loadEngines(),teams=syntheticTeams(e).slice(0,2),ids=teams.flatMap(t=>t.players.map(p=>p.id));
const setting=(environment='calm',traits)=>({version:'fixed-weather-v1',enabled:traits?['weather','temperature-tolerance']:['weather'],
 endPolicy:'alternate-quarters',conditions:{...FIXED_WEATHER[environment]},...(traits?{traits:Object.fromEntries(ids.map(id=>[id,{...traits}]))}:{})});
let probabilityCases=0;
for(const environment of Object.keys(FIXED_WEATHER))for(const side of [0,1])for(const quarter of [1,2,3,4])
 for(const action of ['kick','hand','catch','shot-central'])for(const p of [0,.01,.2,.5,.8,.99,1]){
  const s=e.resolveWeather(setting(environment),ids),q=e.weatherProbability(p,s,side,quarter,action);
  assert.ok(q>=0&&q<=p);if(p===0||p===1)assert.equal(q,p);
  if(environment==='calm')assert.equal(q,p);
  assert.ok(e.weatherRange(s,side,quarter)>=.94&&e.weatherRange(s,side,quarter)<=1.06);probabilityCases++;
 }
for(const environment of ['hot','cold']){
 const low=e.thermalMultipliers(setting(environment,{heat:0,cold:0}),ids[0]);
 const high=e.thermalMultipliers(setting(environment,{heat:1,cold:1}),ids[0]);
 assert.ok(high.fatigue<low.fatigue&&high.recovery>low.recovery);
 const irrelevant=environment==='hot'?{heat:0,cold:1}:{heat:1,cold:0};
 assert.deepEqual(e.thermalMultipliers(setting(environment,irrelevant),ids[0]),low,'Opposite thermal trait must not create an unrelated bonus');
}
for(const traits of [{heat:0,cold:0},{heat:1,cold:1}])assert.deepEqual(e.thermalMultipliers(setting('calm',traits),ids[0]),{fatigue:1,recovery:1});
const windy=setting('wet');assert.ok(Math.abs(e.weatherWind(windy,0,1).tail+e.weatherWind(windy,1,1).tail)<1e-12);
assert.ok(Math.abs(e.weatherWind(windy,0,1).tail+e.weatherWind(windy,0,2).tail)<1e-12);
assert.equal(e.weatherWind({...windy,endPolicy:'fixed'},0,1).tail,e.weatherWind({...windy,endPolicy:'fixed'},0,2).tail);
for(const value of [
 {...setting(),endPolicy:undefined},{...setting(),unknown:true},{...setting(),enabled:['temperature-tolerance']},
 {...setting(),conditions:{...FIXED_WEATHER.calm,temperatureC:Infinity}},
 {...setting(),conditions:{...FIXED_WEATHER.wet,gustKmh:1}},
 {...setting('hot',{heat:.5,cold:.5}),traits:{}},
 {...setting('hot',{heat:.5,cold:.5}),traits:{...setting('hot',{heat:.5,cold:.5}).traits,extra:{heat:.5,cold:.5}}}
])assert.throws(()=>e.resolveWeather(value,ids));
const strip=r=>{const {weatherTelemetry,...rest}=structuredClone(r);delete rest.input.weather;return sportingJSON(rest);};
let neutralReplays=0,fullWeatherReplays=0;
const retained=[];
for(let trial=0;trial<4;trial++){
 const base=inputFor(e,trial%2?[teams[1],teams[0]]:teams,'weather-contract-'+trial,'weather-contract-'+trial,'2026-11-13');
 const snapshot=hash(JSON.stringify(base)),baseline=e.simulateV1(base);
 for(const weather of [undefined,{...setting('hot'),enabled:[]},setting(),setting('calm',{heat:1,cold:0})]){
  const result=e.simulateV2({...base,...(weather?{weather}:{})});auditResult(result,e);
  assert.equal(strip(result),sportingJSON(baseline),'Disabled/calm weather changed a sporting event');neutralReplays++;
 }
 for(const id of ['wind-wet','hot-traits-favored','cold-traits-adverse','hot-psych-favored']){
  const arm=WEATHER_ARMS.find(a=>a.id===id),fixture={swap:Boolean(trial%2)};
  const weather=weatherForArm(e,base,fixture,arm),input={...base,weather};
  const before=hash(JSON.stringify(input)),result=e.simulateV2(input);auditResult(result,e);
  assert.equal(hash(JSON.stringify(e.simulateV2(input))),hash(JSON.stringify(result)));
  assert.equal(hash(JSON.stringify(input)),before);retained.push([result,hash(JSON.stringify(result))]);fullWeatherReplays++;
 }
 assert.equal(hash(JSON.stringify(base)),snapshot);
}
for(const [r,h]of retained)assert.equal(hash(JSON.stringify(r)),h,'Weather result changed after a later game');
let historicalResults=0;
if(process.argv[2]){
 const dir=path.resolve(process.argv[2]),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
 for(const p of m.profiles){
  const f=m.fixtures.find(f=>f.profile===p.id),saved=JSON.parse(gunzipSync(fs.readFileSync(path.join(dir,f.id+'.json.gz'))));
  for(const old of Object.values(saved.results)){
   assert.equal(hash(JSON.stringify(e.simulateV2(old.input))),hash(JSON.stringify(old)),'Weather implementation changed a previously validated psychology result');historicalResults++;
  }
 }
}
console.log(JSON.stringify({status:'passed',runtime,probabilityCases,neutralReplays,fullWeatherReplays,
 historicalPsychologyResultsExactlyPreserved:historicalResults,retainedChecks:retained.length,
 inputImmutable:true,traitsIndependent:true,endPolicyPinned:true,frozenV1Files:verifyBaseline().protectedFiles}));
