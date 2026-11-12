import assert from 'node:assert/strict';
import {loadEngines,syntheticTeams,inputFor,hash,sportingJSON,auditResult,verifyBaseline} from './tools.mjs';
const e=await loadEngines();
const policy={version:'shared-psych-v1',homeSide:0,homeOddsBonus:.004,maximumOddsBonus:.009};
const settings=(enabled,streaks,extra={})=>e.resolveStreakSettings({enabled,streaks,confidenceScale:.35,frustrationScale:1,psychology:{...policy,...extra}});
for(const [streak,expected] of [[-10,0],[-5,0],[-4,.25],[-3,.5],[-2,.75],[-1,1],[0,1],[1,1],[2,1.075],[3,1.15],[4,1.225],[5,1.3],[10,1.3]])
 assert.ok(Math.abs(e.crowdEnthusiasm(streak)-expected)<1e-12);
const peak=settings(['confidence','home-support'],[5,-5]);
const pc=e.psychologyContribution(peak,0);
assert.ok(Math.abs(pc.confidenceOddsBonus-.007)<1e-14);
assert.ok(Math.abs(pc.homeOddsBonus-.0052)<1e-14);
assert.ok(Math.abs(pc.rawOddsBonus-.0122364)<1e-14);
assert.equal(pc.appliedOddsBonus,.009);assert.equal(pc.saturated,true);
const reduced=e.resolveStreakSettings({enabled:['confidence','home-support'],streaks:[5,-5],confidenceScale:.20,
 psychology:{...policy,maximumOddsBonus:.006}});
const rc=e.psychologyContribution(reduced,0);
assert.ok(Math.abs(rc.confidenceOddsBonus-.004)<1e-14);
assert.ok(Math.abs(rc.homeOddsBonus-.0052)<1e-14);
assert.ok(Math.abs(rc.rawOddsBonus-.0092208)<1e-14);
assert.equal(rc.appliedOddsBonus,.006);assert.equal(rc.saturated,true);
assert.equal(e.psychologyContribution(peak,1).appliedOddsBonus,0);
assert.equal(e.psychologyContribution(settings(['home-support'],[-5,0]),0).appliedOddsBonus,0);
assert.equal(e.psychologyContribution(settings(['home-support'],[5,0],{homeSide:null}),0).appliedOddsBonus,0);
const capped=[];
for(const homeSide of [null,0,1])for(const a of [-100,-5,-3,0,3,5,100])for(const b of [-100,-5,-3,0,3,5,100]){
 const q=settings(['confidence','home-support'],[a,b],{homeSide});
 for(const side of [0,1]){const c=e.psychologyContribution(q,side);assert.ok(c.appliedOddsBonus>=0&&c.appliedOddsBonus<=.009);capped.push(c.appliedOddsBonus);}
 for(const p of [.01,.1,.5,.9,.99]){
  const direct=e.psychologicalProbability(p,q,0,true);
  const complementary=e.psychologicalProbability(1-p,q,1,true);
  assert.ok(Math.abs(direct+complementary-1)<1e-12);
  assert.ok(direct>0&&direct<1,'Modifiers must not produce guaranteed action outcomes');
 }
}
assert.equal(e.psychologicalProbability(0,peak,0),0);assert.equal(e.psychologicalProbability(1,peak,0),1);
for(const invalid of [{...policy,homeSide:[0,1]},{...policy,maximumOddsBonus:-1},{...policy,homeOddsBonus:Infinity},{...policy,version:'unknown'},{...policy,unknown:1}])
 assert.throws(()=>e.resolveStreakSettings({enabled:['home-support'],streaks:[0,0],psychology:invalid}));
const teams=syntheticTeams(e);const base=inputFor(e,teams.slice(0,2),'psychology-unit','psychology-unit','2026-11-12');
const strip=r=>{const{labTelemetry,...rest}=r;return hash(sportingJSON(rest));};
for(const lab of [
 {enabled:[],streaks:[5,-5],confidenceScale:.35,psychology:policy},
 {enabled:['home-support'],streaks:[5,0],confidenceScale:.35,psychology:{...policy,homeSide:null}},
 {enabled:['home-support'],streaks:[-5,0],confidenceScale:.35,psychology:policy},
 {enabled:['confidence','home-support'],streaks:[5,0],confidenceScale:.35,psychology:{...policy,maximumOddsBonus:0}}
]){const input={...structuredClone(base),lab};assert.equal(strip(e.simulateV2(input)),strip(e.simulateV1(input)),'Neutralized policy changed sporting events');}
const input={...structuredClone(base),lab:{enabled:['confidence','frustration','home-support'],streaks:[5,-5],confidenceScale:.35,frustrationScale:1,psychology:policy}};
const original=hash(JSON.stringify(input)),r=e.simulateV2(input);auditResult(r,e);
assert.equal(hash(JSON.stringify(e.simulateV2(JSON.parse(JSON.stringify(r.input))))),hash(JSON.stringify(r)));
assert.equal(hash(JSON.stringify(input)),original);
assert.equal(r.labTelemetry.psychology.contributions[0].appliedOddsBonus,.009);
verifyBaseline();
console.log(JSON.stringify({status:'passed',version:policy.version,confidenceScale:.35,homeBaseOddsBonus:.004,sharedMaximumOddsBonus:.009,
 reducedCandidate:{confidenceScale:.20,sharedMaximumOddsBonus:.006,peakConfidenceOddsBonus:rc.confidenceOddsBonus,peakHomeOddsBonus:rc.homeOddsBonus,rawPeakOddsBonus:rc.rawOddsBonus},
 exhaustiveContributionChecks:capped.length,fullReplay:true,losingHomeNeutralization:true,neutralSiteParity:true,noOutcomeClamps:true,officialWrites:0}));
