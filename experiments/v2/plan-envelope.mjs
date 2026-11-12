import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { labRoot, readJSON, featureRegistry } from './tools.mjs';
export function validateScenario(scenario,plan) {
 assert.ok(typeof scenario.id==='string'&&/^[a-z0-9-]+$/.test(scenario.id));
 assert.ok(Array.isArray(scenario.requires)&&new Set(scenario.requires).size===scenario.requires.length);
 for(const feature of scenario.requires)assert.ok(featureRegistry.features.some(x=>x.id===feature),'Unknown feature');
 assert.ok([null,0,1].includes(scenario.home),'There can be only one host or a neutral site');
 assert.ok(Array.isArray(scenario.streaks)&&scenario.streaks.length===2&&scenario.streaks.every(Number.isSafeInteger));
 const env=plan.environments[scenario.environment];assert.ok(env,'Unknown shared environment');
 assert.ok(['hot','cold','neutral'].includes(env.thermalBand),'Heat and cold cannot be maximized simultaneously');
 assert.ok(Number.isFinite(env.temperatureC)&&env.relativeHumidity>=0&&env.relativeHumidity<=100&&env.windKmh>=0&&env.gustKmh>=env.windKmh&&env.rainMmPerHour>=0);
 assert.ok(['matched','focal-favored','opponent-favored'].includes(scenario.weatherFit));
 assert.ok(['neutral','focal-favored','opponent-favored'].includes(scenario.thermalTraits));
 assert.ok(['off','focal-only','opponent-only','both'].includes(scenario.adaptation));
 if(scenario.home!==null)assert.ok(scenario.requires.includes('home-support'));
 if(scenario.environment!=='temperate'||scenario.weatherFit!=='matched')assert.ok(scenario.requires.includes('weather'));
 if(scenario.thermalTraits!=='neutral')assert.ok(env.thermalBand!=='neutral'&&scenario.requires.includes('temperature-tolerance'));
 if(scenario.adaptation!=='off')assert.ok(scenario.requires.includes('halftime-adaptation'));
 return true;
}
export function compilePlan(plan=readJSON(path.join(labRoot,'envelope-plan.json'))) {
 assert.equal(plan.runtimeIntegration,false,'Planning criteria must not alter the engine');
 assert.equal(new Set(plan.scenarios.map(x=>x.id)).size,plan.scenarios.length);
 const cases=[];
 for(const scenario of plan.scenarios){
  validateScenario(scenario,plan);
  const missing=scenario.requires.filter(id=>featureRegistry.features.find(feature=>feature.id===id).status!=='implemented');
  for(const quality of plan.axes.quality)for(const tacticalContext of plan.axes.tacticalContext)for(const roleSwap of plan.axes.roleSwap)
   cases.push({id:`${scenario.id}:${quality}:${tacticalContext}:${Number(roleSwap)}`,scenarioId:scenario.id,quality,tacticalContext,roleSwap,
    featureStatus:missing.length?'blocked-unimplemented-features':'features-available',missingFeatures:missing,
    executionStatus:'planning-only-not-simulated',parameters:scenario});
 }
 return{schema:'century-envelope-matrix-v1',status:'planning-only',budgetsStatus:plan.status,criteriaAreOutcomeClamps:false,cases};
}
/** Review-only diagnostics; never used to set an engine probability or result. */
export function assessEnvelope({baselineWinRate,modifiedWinRate,upsetsObserved}) {
 assert.ok([baselineWinRate,modifiedWinRate].every(x=>Number.isFinite(x)&&x>=0&&x<=1));
 assert.ok(upsetsObserved===undefined||(Number.isSafeInteger(upsetsObserved)&&upsetsObserved>=0));
 const plan=readJSON(path.join(labRoot,'envelope-plan.json')),b=plan.budgets.wholeStack;
 const changePoints=100*(modifiedWinRate-baselineWinRate);
 const balanced=baselineWinRate>=b.balancedBaselineRange[0]&&baselineWinRate<=b.balancedBaselineRange[1];
 const reasons=[];
 if(Math.abs(changePoints)>b.outerExtremeLiftReviewPoints)reasons.push('change-from-own-control-exceeds-proposed-review-limit');
 if(balanced&&(modifiedWinRate>b.outerFavoredWinRateReview||modifiedWinRate<1-b.outerFavoredWinRateReview))reasons.push('matched-club-outer-envelope-exceeded');
 if(upsetsObserved===0)reasons.push('zero-upsets-in-finite-sample-requires-investigation-not-proof-of-invincibility');
 return{changePoints,balancedControl:balanced,status:reasons.length?'review-required':'within-provisional-outer-screen',reasons,
  note:'Descriptive screening only. Need adequate paired samples and uncertainty; no engine probability or winner is clipped.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const result=compilePlan();
 console.log(JSON.stringify({status:result.status,scenarioDefinitions:new Set(result.cases.map(x=>x.scenarioId)).size,scenarioCells:result.cases.length,
  featureAvailableCells:result.cases.filter(x=>!x.missingFeatures.length).length,blockedCells:result.cases.filter(x=>x.missingFeatures.length).length,
  missingFeatures:[...new Set(result.cases.flatMap(x=>x.missingFeatures))],actualSimulations:0,engineChanges:0},null,2));
}
