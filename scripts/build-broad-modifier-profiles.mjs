import fs from'node:fs';import assert from'node:assert/strict';import{loadEngines,hash,readJSON,atomicJSON}from'../experiments/v2/tools.mjs';import{PRESSURE}from'./broad-modifier-spec.mjs';
const [teamsFile,trustedFile,out]=process.argv.slice(2);assert.ok(out);const bytes=fs.readFileSync(teamsFile),teams=JSON.parse(bytes),trusted=readJSON(trustedFile);assert.equal(hash(bytes),trusted.teamsJSONSHA256);assert.equal(teams.length,18);assert.equal(new Set(teams.flatMap(t=>t.players.map(p=>p.id))).size,630);for(const t of teams)assert.equal(t.players.length,35);
const byId=new Map(teams.map(t=>[t.id,t]));for(const p of trusted.profiles)for(const t of p.teams)assert.deepEqual(byId.get(t.id),t);
const e=await loadEngines(),tacticKeys=Object.keys(teams[0].coach.tactics);let profiles=[];
const stats=t=>({meanRating:t.players.reduce((s,p)=>s+Object.values(p.ratings).reduce((a,b)=>a+b,0),0)/t.players.reduce((s,p)=>s+Object.keys(p.ratings).length,0),playersSHA256:hash(JSON.stringify(t.players))});
const copied=teams.toSorted((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
for(let pair=0;pair<9;pair++)for(const reverse of[false,true])for(const tactics of['original','pressure']){
 const ts=structuredClone(copied.slice(pair*2,pair*2+2));if(reverse)ts.reverse();if(tactics==='pressure')for(const t of ts)Object.assign(t.coach.tactics,PRESSURE);
 const id=`copied-${pair+1}-${Number(reverse)}-${tactics}`;profiles.push({id,pairId:`copied-${pair+1}`,cohort:'copied',quality:'copied',tactics,reverse,teams:ts,rosterStats:ts.map(stats)});
}
for(let rep=0;rep<4;rep++){
 const generate=(label,mean)=>{const id=`SYN-BROAD-${rep}-${label}`,rng=e.createRandom('century-broad-modifier-population-v1:'+id);return{id,name:`Synthetic ${rep+1} ${label}`,coach:{name:'Synthetic laboratory coach',tactics:Object.fromEntries(tacticKeys.map(k=>[k,3]))},players:Array.from({length:35},(_,i)=>({id:id+'-'+i,name:id+' player '+i,ratings:Object.fromEntries(e.ATTRIBUTE_KEYS.map(k=>[k,Math.max(1,Math.min(20,mean+rng.normal(0,1.5)))]))}))};};
 const focal=generate('focal',11);for(const [quality,label,mean]of[['matched','matched',11],['weaker','higher',12.5],['stronger','lower',9.5]]){
  const opponent=generate(label,mean);for(const tactics of['neutral','pressure']){const ts=structuredClone([focal,opponent]);if(tactics==='pressure')for(const t of ts)Object.assign(t.coach.tactics,PRESSURE);profiles.push({id:`synthetic-${rep+1}-${quality}-${tactics}`,pairId:`synthetic-${rep+1}-${quality}`,cohort:'synthetic',quality,tactics,replicate:rep+1,teams:ts,rosterStats:ts.map(stats)});}
 }
}
assert.equal(profiles.length,60);assert.equal(profiles.filter(p=>p.cohort==='copied').length,36);assert.equal(profiles.filter(p=>p.cohort==='synthetic').length,24);
for(const p of profiles){const [f,o]=p.rosterStats.map(x=>x.meanRating);if(p.quality==='weaker')assert.ok(o-f>1);if(p.quality==='stronger')assert.ok(f-o>1);}
const result={schema:'century-broad-modifier-profiles-v1',sourceArchiveSHA256:trusted.sourceArchiveSHA256,teamsJSONSHA256:hash(bytes),sourceSnapshotDate:'2026-10-31',copiedPlayerMembershipUnique:630,trustedEightClubCopiesExactlyMatched:true,sourceDraftCrosscheck:'Earlier trusted-source attestation retained; current validation checks all 630 unique memberships in the unchanged source snapshot.',populationPolicy:'Four independent generated replicates, attribute means11/12.5/9.5 SD1.5 clipped1..20; no official player edit or hidden quality scalar.',profiles};atomicJSON(out,result);console.log(JSON.stringify({status:'passed',profiles:60,copiedClubs:18,copiedProfiles:36,syntheticProfiles:24}));
