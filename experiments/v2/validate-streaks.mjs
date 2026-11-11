import assert from 'node:assert/strict';
import { loadEngines, syntheticTeams, inputFor, sportingJSON, hash, auditResult, verifyBaseline } from './tools.mjs';
const e = await loadEngines();
const { confidenceOddsBonus: c, frustrationRelativeBonus: f, confidenceProbability: cp, seriousFoulProbability: sp } = e;
for (const streak of [-20, -5, -1, 0, 1]) assert.equal(c(streak), 0);
for (const [streak, bonus] of [[2,.005],[3,.01],[4,.015],[5,.02],[100,.02]]) assert.equal(c(streak), bonus);
for (const streak of [0,1,3,10]) assert.equal(f(streak, 11), 0);
assert.equal(f(-1, 11), 0); assert.equal(f(-3, 11), .02); assert.equal(f(-5, 11), .04);
assert.equal(f(-100,11),f(-5,11)); assert.ok(f(-5,20)<f(-5,11) && f(-5,11)<f(-5,1));
for (const p of [0,.01,.1,.5,.9,.999,1]) {
  assert.equal(cp(p,3,3),p); assert.equal(cp(p,-5,0),p); assert.equal(cp(p,5,0,0),p);
  assert.equal(sp(p,-5,11,0),p);
  for(let streak=2;streak<6;streak++) assert.ok(cp(p,streak)>=cp(p,streak-1));
  assert.ok(cp(p,5)<=1 && cp(p,0,5)>=0);
}
assert.ok(Math.abs(cp(.5,3)-.5024875621890548)<1e-14);
assert.ok(Math.abs(sp(.09,-3,11)-.0918)<1e-14);
assert.ok(Math.abs(sp(.09,-5,11)-.0936)<1e-14);
for(const lab of [null,{}, {enabled:['home-support'],streaks:[0,0]}, {enabled:['confidence','confidence'],streaks:[0,0]},
  {enabled:[],streaks:[1.5,0]}, {enabled:[],streaks:[1,0],confidenceScale:NaN}, {enabled:[],streaks:[1,0],unknown:1}])
  assert.throws(()=>e.resolveStreakSettings(lab));
// Uniform threshold sweep: controlled probability verification, not a match sample or an empirical risk estimate.
const n=1000000, probes=[];
for(const discipline of [1,11,20]) for(const streak of [-2,-3,-5]) {
  const baseline=.09, adjusted=sp(baseline,streak,discipline);let baseCount=0,changedCount=0;
  for(let i=0;i<n;i++){const u=(i+.5)/n;baseCount+=Number(u<baseline);changedCount+=Number(u<adjusted);}
  assert.ok(Math.abs(changedCount/n-adjusted)<=1/n);
  probes.push({discipline,streak,opportunities:n,baselineEvents:baseCount,adjustedEvents:changedCount,
    baselineProbability:baseline,adjustedProbability:adjusted});
}
const teams=syntheticTeams(e),input=inputFor(e,teams.slice(0,2),'streak-unit','streak-unit','2026-11-11');
const original=JSON.stringify(input);
const legacy=e.simulateV1(input),plain=e.simulateV2(input);
assert.equal(hash(sportingJSON(legacy)),hash(sportingJSON(plain)));
function sportingWithoutTelemetry(result){const {labTelemetry,...rest}=result;return hash(sportingJSON(rest));}
for(const lab of [
  {enabled:[],streaks:[5,-5]},
  {enabled:['confidence'],streaks:[0,1]},
  {enabled:['frustration'],streaks:[0,-1]},
  {enabled:['confidence','frustration'],streaks:[5,-5],confidenceScale:0,frustrationScale:0}
]) {
  const same={...input,lab};
  assert.equal(sportingWithoutTelemetry(e.simulateV2(same)),sportingWithoutTelemetry(e.simulateV1(same)), 'Zero-effect feature changed sporting events');
}
const cases=[];
for(const enabled of [['confidence'],['frustration'],['confidence','frustration']]) {
  const pinned={...input,lab:{enabled,streaks:[3,-3]}};
  const r=e.simulateV2(pinned);auditResult(r,e);
  assert.equal(hash(JSON.stringify(e.simulateV2(JSON.parse(JSON.stringify(r.input))))),hash(JSON.stringify(r)), 'Enabled feature failed full replay');
  assert.equal(JSON.stringify(input),original);
  const t=r.labTelemetry;
  assert.equal(t.severity.reduce((s,c)=>s+c.opportunities,0),r.events.filter(x=>x.type==='foul').length);
  assert.equal(t.severity.reduce((s,c)=>s+c.successes,0),r.events.filter(x=>x.type==='foul'&&x.data.serious).length);
  if(!enabled.includes('frustration'))for(const c of t.severity)assert.equal(c.baselineProbabilitySum,c.adjustedProbabilitySum);
  if(!enabled.includes('confidence'))for(const rows of Object.values(t.confidence))for(const c of rows)assert.equal(c.baselineProbabilitySum,c.adjustedProbabilitySum);
  const contacts=t.contacts.reduce((s,c)=>s+c,0);assert.ok(contacts>=t.severity.reduce((s,c)=>s+c.opportunities,0));
  cases.push({enabled,scores:r.scores,fouls:t.severity.reduce((s,c)=>s+c.opportunities,0),contacts});
}
verifyBaseline();
console.log(JSON.stringify({status:'passed',baselineUnchanged:true,noFeatureParity:true,zeroEffectParity:true,
  fullEnabledReplays:cases.length,uniformSeverityProbes:probes,enabledMatchChecks:cases,
  note:'Controlled mechanics and replay checks only; not a calibrated match-effect estimate.'},null,2));
