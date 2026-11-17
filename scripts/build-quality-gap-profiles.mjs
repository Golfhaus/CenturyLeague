import assert from'node:assert/strict';import{loadEngines,hash,atomicJSON}from'../experiments/v2/tools.mjs';import{ensureQualifiedStudyProcess,qualifyStudyRuntime}from'../experiments/v2/runtime.mjs';import{OFFSETS,PRESSURE}from'./quality-gap-spec.mjs';
ensureQualifiedStudyProcess();qualifyStudyRuntime();const out=process.argv[2];assert.ok(out);const e=await loadEngines(),keys=['tempo','physicality','defensive_posture','pressure','transition_emphasis','width','aerial_emphasis','ball_risk','running_movement_emphasis','defensive_aggression'];let profiles=[];
const stats=t=>({meanRating:t.players.reduce((s,p)=>s+Object.values(p.ratings).reduce((a,b)=>a+b,0),0)/t.players.reduce((s,p)=>s+Object.keys(p.ratings).length,0),playersSHA256:hash(JSON.stringify(t.players))});
for(let rep=1;rep<=4;rep++){
 const rng=e.createRandom('century-quality-ladder-mirror-population-v1:'+rep),latent=Array.from({length:35},()=>Object.fromEntries(e.ATTRIBUTE_KEYS.map(k=>[k,rng.normal(0,1.5)])));
 const team=(role,gap)=>{const id=`SYN-QUALITY-${rep}-${role}`;return{id,name:`Synthetic quality template ${rep} ${role}`,coach:{name:'Synthetic fixed laboratory coach',tactics:Object.fromEntries(keys.map(k=>[k,3]))},players:latent.map((z,i)=>({id:id+'-'+i,name:id+' player '+i,ratings:Object.fromEntries(e.ATTRIBUTE_KEYS.map(k=>[k,Math.max(1,Math.min(20,11+gap+z[k]))]))}))};};
 for(const gap of OFFSETS)for(const tactics of['neutral','pressure']){
  const teams=[team('focal',0),team('opponent',gap)];if(tactics==='pressure')for(const t of teams)Object.assign(t.coach.tactics,PRESSURE);
  const code=gap===0?'zero':(gap>0?'plus':'minus')+String(Math.abs(gap)).replace('.','p');const p={id:`quality-${rep}-${code}-${tactics}`,pairId:`quality-${rep}-${code}`,replicate:rep,cohort:'synthetic',quality:gap===0?'matched':gap>0?'weaker':'stronger',gap,tactics,teams,rosterStats:teams.map(stats)};
  if(gap===0)assert.deepEqual(teams[0].players.map(p=>p.ratings),teams[1].players.map(p=>p.ratings));profiles.push(p);
 }
}
assert.equal(profiles.length,88);atomicJSON(out,{schema:'century-quality-gap-profiles-v1',populationPolicy:'Four independent generated templates; mirrored latent skill patterns with explicit opponent mean offsets; clipped1..20, SD1.5; stable synthetic identities across counterfactual versions; no official player edits or hidden engine scalar.',offsets:OFFSETS,profiles});console.log(JSON.stringify({status:'passed',profiles:88,offsets:OFFSETS}));
