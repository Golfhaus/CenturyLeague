import assert from'node:assert/strict';import{auditPhysical}from'./physical.mjs';import{auditTelemetry}from'./telemetry.mjs';
export function auditPolicyResult(result,e){
 auditPhysical(result,e);auditTelemetry(result,e);const decisions=result.events.filter(x=>x.type==='halftime_decision');assert.equal(decisions.length,2);assert.deepEqual(result.halftimeTelemetry.decisions,decisions.map(x=>x.data));
 const prefixEnd=result.events.findIndex(x=>x.type==='quarter_end'&&x.quarter===2)+1;assert.ok(prefixEnd>0);
 const totals=e.publicTotals(result.events.slice(0,prefixEnd)),firstDecision=result.events.indexOf(decisions[0]);
 const review=result.events.slice(prefixEnd,firstDecision).filter(x=>x.quarter===3);
 const weather=e.resolveWeather(result.input.weather,result.input.teams.flatMap(t=>t.players.map(p=>p.id)));
 const players=new Map(result.input.teams.flatMap((t,side)=>t.players.map(p=>[p.id,{id:p.id,side,ratings:p.ratings,on:false,energy:1,stint:0}])));let beforeInterval;
 const snapshot=side=>[...players.values()].filter(p=>p.side===side&&p.on);
 for(const event of result.events.slice(0,firstDecision)){
  const p=event.playerId&&players.get(event.playerId);
  if(event.type==='lineup')for(const id of event.data.playerIds)players.get(id).on=true;
  if(event.type==='injury'||event.type==='penalty_start')p.on=false;
  if(event.type==='penalty_end'&&event.data.returns){p.on=true;p.stint=0;}
  if(event.type==='substitution'){if(event.otherPlayerId)players.get(event.otherPlayerId).on=false;p.on=true;p.stint=0;}
  if(event.type==='time')for(const p of players.values()){
   const dt=event.data.seconds,mode=event.data.mode,t=result.input.teams[p.side].coach.tactics,thermal=e.thermalMultipliers(weather,p.id);
   if(mode==='playing'&&p.on){p.energy=Math.max(.15,p.energy-dt*result.config.fatiguePerSecond*(.85+.07*t.pressure+.035*t.running_movement_emphasis+.02*t.physicality)*(1.5-p.ratings.stamina/25)*thermal.fatigue);p.stint+=dt;}
   else p.energy=Math.min(1,p.energy+dt*result.config.benchRecoveryPerSecond*(.6+p.ratings.recovery/20)*(mode==='interval'?.65:p.on?.18:1)*thermal.recovery);
  }
  if(event.type==='quarter_end'&&event.quarter===2)beforeInterval=[0,1].map(side=>snapshot(side).map(p=>({id:p.id,energy:p.energy,stint:p.stint})));
 }
 assert.ok(beforeInterval);
 for(const side of [0,1]){
  const d=decisions.find(x=>x.side===side).data,o=d.observation;
  assert.equal(d.mode,result.input.halftime.sides[side]);assert.equal(d.side,side);assert.equal(o.side,side);assert.deepEqual(o.publicTotals,totals);assert.deepEqual(o.root,result.input.teams[side].coach.tactics);
  assert.deepEqual(o.scores,result.events[prefixEnd-1].data.cumulative);assert.deepEqual(o.personnelReview,review.filter(x=>x.side===side));
  const observed=snapshot(side);assert.deepEqual(o.ownOnField.map(p=>p.id),observed.map(p=>p.id));assert.deepEqual(o.ownBeforeInterval.map(p=>p.id),beforeInterval[side].map(p=>p.id));
  o.ownOnField.forEach((p,i)=>{assert.deepEqual(p.ratings,observed[i].ratings);assert.ok(Math.abs(p.energy-observed[i].energy)<1e-8);});
  o.ownBeforeInterval.forEach((p,i)=>{assert.ok(Math.abs(p.energy-beforeInterval[side][i].energy)<1e-8);assert.ok(Math.abs(p.stint-beforeInterval[side][i].stint)<1e-7);});
  assert.deepEqual(d,e.decideHalftime(o,d.mode));const selected=d.candidates.find(c=>c.id===d.choice);if(selected&&['aerial','lower-aerial'].includes(selected.recipe))assert.notEqual(selected.tactics.aerial_emphasis,o.root.aerial_emphasis);assert.ok(d.rootDistance<=2);assert.ok(Object.values(d.effectiveTactics).every(x=>x>=1&&x<=5));
  assert.ok(Object.keys(o).every(k=>['side','scores','root','ownOnField','ownBeforeInterval','publicTotals','personnelReview'].includes(k)),'Unexpected hidden observation');
 }
 return {prefixEnd,decisions:decisions.map(x=>x.data)};
}
