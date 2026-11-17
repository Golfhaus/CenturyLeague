import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadEngines,inputFor,hash,auditResult,verifyBaseline} from '../experiments/v2/tools.mjs';
import {ensureQualifiedStudyProcess,qualifyStudyRuntime} from '../experiments/v2/runtime.mjs';
import {weatherForArm,WEATHER_ARMS} from '../experiments/v2/weather-fixtures.mjs';
ensureQualifiedStudyProcess();
const runtime=qualifyStudyRuntime(),e=await loadEngines();
const m=JSON.parse(fs.readFileSync(process.argv[2])),refs=JSON.parse(fs.readFileSync(process.argv[3]));
const ids=['control','hot-wet-shared','hot-wet-traits-favored','hot-wet-traits-adverse','hot-psych-favored','hot-psych-adverse'];
assert.deepEqual(e.WEATHER_CANDIDATE,m.weatherStudy.candidate);
let count=0;
for(const fixture of m.fixtures.filter(f=>f.trial===0)){
 const profile=m.profiles.find(p=>p.id===fixture.profile),teams=fixture.swap?[profile.teams[1],profile.teams[0]]:profile.teams;
 const focal=fixture.swap?1:0,base=inputFor(e,teams,fixture.id,fixture.seed,m.matchDate);
 for(const arm of m.arms.filter(a=>ids.includes(a.id))){
  assert.deepEqual(WEATHER_ARMS.find(a=>a.id===arm.id),arm);
  const streaks=[0,0];streaks[focal]=arm.focal;streaks[1-focal]=arm.opponent;
  const weather=weatherForArm(e,base,fixture,arm);
  const input={...structuredClone(base),...(weather?{weather}:{}),lab:{enabled:arm.enabled,streaks,
   confidenceScale:m.coefficients.scales[0],frustrationScale:1,
   psychology:{...m.coefficients.sharedPsychology,homeSide:arm.home==='focal'?focal:arm.home==='opponent'?1-focal:null}}};
  const result=e.simulateV2(input);auditResult(result,e);
  assert.equal(hash(JSON.stringify(result)),refs[fixture.id+':'+arm.id],'Screen replay changed');count++;
 }
}
console.log(JSON.stringify({status:'passed',screenResultsReproducedExactly:count,unchangedCoefficients:true,unchangedArms:true,baseline:verifyBaseline(),runtime}));
