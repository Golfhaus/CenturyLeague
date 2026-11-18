import assert from 'node:assert/strict';import {auditResult} from '../halftime-boundary/tools.mjs';
export const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`Numeric mismatch ${a} ${b}`);
export function auditPhysical(result,e){
 auditResult(result,e);e.validateCompetitiveInput(result.input);const weather=e.resolveWeather(result.input.weather,result.input.teams.flatMap(t=>t.players.map(p=>p.id))),eligible=new Set(result.input.availability.players.filter(p=>p.eligible).map(p=>p.playerId));
 const players=new Map(result.input.teams.flatMap((t,side)=>t.players.filter(p=>eligible.has(p.id)).map(p=>[p.id,{id:p.id,side,ratings:p.ratings,on:false,available:true,energy:1,stint:0,thermal:e.thermalMultipliers(weather,p.id)}]))),all=[...players.values()],tactics=result.input.teams.map(t=>({...t.coach.tactics})),penalties=[new Set(),new Set()];let playing=0,elapsed=0,decisions=0;
 const wt={activePlayerSeconds:[0,0],energySeconds:[0,0],extraRequestedFatigue:[0,0],energyFloorSeconds:[0,0]};
 for(const [i,event]of result.events.entries()){
  assert.equal(event.id,i+1);near(event.playingSeconds,playing,1e-10);near(event.elapsedSeconds,elapsed,1e-10);const side=event.side,p=event.playerId&&players.get(event.playerId);if(event.playerId){assert.ok(p);assert.equal(p.side,side);}
  if(event.type==='lineup')for(const id of event.data.playerIds){assert.ok(players.has(id));players.get(id).on=true;}
  if(event.type==='injury'){assert.ok(p.on);p.on=false;p.available=false;}
  if(event.type==='penalty_start'){assert.ok(p.on);p.on=false;penalties[side].add(event.playerId);}
  if(event.type==='penalty_end'){assert.ok(penalties[side].has(event.playerId));penalties[side].delete(event.playerId);if(event.data.returns){assert.ok(p.available);p.on=true;p.stint=0;}}
  if(event.type==='substitution'){assert.equal(event.data.authorized,true);assert.ok(p.available&&!p.on&&!penalties[side].has(event.playerId));if(event.otherPlayerId){assert.ok(players.get(event.otherPlayerId).on);players.get(event.otherPlayerId).on=false;}p.on=true;p.stint=0;}
  if(event.type==='halftime_decision'){decisions++;assert.equal(event.quarter,3);tactics[side]=event.data.effectiveTactics;assert.ok(Object.values(tactics[side]).every(x=>x>=1&&x<=5));}
  if(event.type==='time'){
   const dt=event.data.seconds,mode=event.data.mode;assert.ok(Number.isFinite(dt)&&dt>=0);
   for(const s of [0,1]){const n=all.filter(p=>p.side===s&&p.on).length;assert.ok(n<=15-penalties[s].size);if(mode==='playing')assert.ok(n>=result.config.minimumPlayers);}
   for(const p of all){if(mode==='playing'&&p.on){const t=tactics[p.side],loss=dt*result.config.fatiguePerSecond*(.85+.07*t.pressure+.035*t.running_movement_emphasis+.02*t.physicality)*(1.5-p.ratings.stamina/25),adjusted=loss*p.thermal.fatigue;p.energy=Math.max(.15,p.energy-adjusted);p.stint+=dt;wt.activePlayerSeconds[p.side]+=dt;wt.energySeconds[p.side]+=dt*p.energy;wt.extraRequestedFatigue[p.side]+=adjusted-loss;if(p.energy===.15)wt.energyFloorSeconds[p.side]+=dt;}
    else p.energy=Math.min(1,Math.max(.15,p.energy+dt*result.config.benchRecoveryPerSecond*(.6+p.ratings.recovery/20)*(mode==='interval'?.65:p.on?.18:1)*p.thermal.recovery));}
   elapsed+=dt;if(mode==='playing')playing+=dt;
  }
 }
 assert.equal(decisions,result.input.halftime?2:0);near(playing,result.playingSeconds,1e-10);near(elapsed,result.elapsedSeconds,1e-10);assert.equal(result.events.at(-1).data.finalCondition.length,players.size);
 for(const f of result.events.at(-1).data.finalCondition){const p=players.get(f.playerId);assert.equal(f.available,p.available);near(f.energy,p.energy,1e-9);}
 if(weather?.enabled.includes('weather')){assert.ok(result.weatherTelemetry);assert.deepEqual(result.weatherTelemetry.conditions,weather.conditions);for(const k of Object.keys(wt))for(const side of [0,1])near(result.weatherTelemetry[k][side],wt[k][side],1e-9);for(const side of [0,1]){const ps=all.filter(p=>p.side===side);near(result.weatherTelemetry.finalMeanEnergy[side],ps.reduce((n,p)=>n+p.energy,0)/ps.length,1e-9);}}
 else assert.equal(result.weatherTelemetry,undefined);
 return{weatherEnergyChecks:weather?8:0,decisions};
}
