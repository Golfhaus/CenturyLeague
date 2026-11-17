import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{fileURLToPath}from'node:url';
import{hash,readJSON}from'../experiments/v2/tools.mjs';import{stageInput,COMBINED_ARMS}from'../experiments/v2/modifier-stage-fixtures.mjs';import{weatherForArm}from'../experiments/v2/weather-fixtures.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const PRESSURE={pressure:5,defensive_aggression:5,physicality:4,running_movement_emphasis:5};
export const BROAD_ARMS=[{id:'control'},...['favored','adverse'].map(d=>({id:'ordinary-'+d,ordinary:true,direction:d})),...COMBINED_ARMS.filter(a=>a.id.startsWith('psych-')||a.id.includes('-combined-'))];
export const MODERATE=[{temperatureC:22,relativeHumidity:55,windKmh:5,gustKmh:10,rainMmPerHour:0,windDirectionDegrees:45},{temperatureC:28,relativeHumidity:70,windKmh:10,gustKmh:20,rainMmPerHour:0,windDirectionDegrees:45},{temperatureC:18,relativeHumidity:80,windKmh:15,gustKmh:25,rainMmPerHour:1,windDirectionDegrees:45}];
export const PINNED_BROAD_FILES=['scripts/broad-modifier-spec.mjs','scripts/build-broad-modifier-profiles.mjs','scripts/run-broad-modifier-validation.mjs','scripts/broad-modifier-worker.mjs','scripts/validate-broad-modifier-validation.mjs','scripts/audit-broad-modifier-validation.mjs','scripts/analyze-broad-modifier-validation.py','scripts/recompute-broad-modifier-validation.py','docs/BROAD_MODIFIER_VALIDATION_PLAN_2026_11_15.md'];
export function broadHarnessFingerprint(){return hash(JSON.stringify(PINNED_BROAD_FILES.map(f=>[f,hash(fs.readFileSync(path.join(repo,f)))])));}
export function broadInput(e,p,f,arm){
 let input;
 if(arm.ordinary){
  input=stageInput(e,p,f,COMBINED_ARMS.find(a=>a.id==='control'),'combined');input.weather=weatherForArm(e,input,f,{weather:{environment:'hotWet',traits:'normal',endPolicy:'alternate-quarters',thermalCandidate:'reduced-035'}});input.weather.conditions={...MODERATE[Math.floor(f.trial/2)%3]};
  const side=Number(f.swap),favored=arm.direction==='favored',streaks=[0,0];streaks[side]=favored?2:-2;streaks[1-side]=favored?-2:2;input.lab={enabled:['confidence','frustration','home-support'],streaks,confidenceScale:.2,frustrationScale:1,psychology:{version:'shared-psych-v1',homeOddsBonus:.004,maximumOddsBonus:.006,homeSide:favored?side:1-side}};
 }else input=stageInput(e,p,f,COMBINED_ARMS.find(a=>a.id===arm.id),'combined');
 input.availability=e.pinAvailability(input,'men','2026-11-15',[],[]);return input;
}
export function verifyPrior(dir,source){
 const m=readJSON(path.join(dir,'manifest.json')),a=readJSON(path.join(dir,'analysis.json')),v=readJSON(path.join(dir,'ledger-verification.json')),i=readJSON(path.join(dir,'independent-recomputation.json'));
 assert.equal(m.studyId,'hot-favored-combined-confirmation-001');assert.equal(a.status,'completed');assert.equal(v.status,'passed');assert.equal(i.status,'passed');assert.equal(v.fullOutcomesVerified,20480);assert.equal(i.outcomes,20480);for(const p of[m,a,v,i])assert.equal(p.sourceSHA256,source);
 return{studyId:m.studyId,evidenceSHA256:Object.fromEntries(['manifest.json','analysis.json','ledger-verification.json','independent-recomputation.json'].map(f=>[f,hash(fs.readFileSync(path.join(dir,f)))]))};
}
