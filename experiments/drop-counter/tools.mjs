import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import zlib from 'node:zlib';
import {stripTypeScriptTypes} from 'node:module';import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadEngines,sourceFingerprint,verifyBaseline,verifyImportBoundary,hash,atomicJSON,labRoot,auditResult} from '../v2/tools.mjs';
export {hash,atomicJSON,auditResult};
export const root=fileURLToPath(new URL('.',import.meta.url)),repo=path.resolve(root,'../..');
export const prefixSource='57025c84a95713c4ed3701d53cf75109555fd6d41f9bfe11220074c476057115';
export const readGzip=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(p)));
export function identity(){
 verifyBaseline();verifyImportBoundary();assert.equal(sourceFingerprint(),'ad8492b0fccbf45e730dffe941d9476e39c5e1d386aedbc31ac524237bbb7329');
 const visited=new Set();
 const visit=f=>{const rel=path.relative(repo,f);assert.ok(rel==='experiments/drop-counter/src/engine.ts'||rel.startsWith('packages/simulation-core/src/')||['experiments/v2/src/streaks.ts','experiments/v2/src/weather.ts'].includes(rel));
  if(visited.has(rel))return;visited.add(rel);const source=fs.readFileSync(f,'utf8');assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|require)\s*\(|\bimport\s*\(/.test(source));
  for(const m of source.matchAll(/\b(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){assert.ok(m[1].startsWith('.'));visit(path.resolve(path.dirname(f),m[1].replace(/\.js$/,'.ts')));}};
 visit(path.join(root,'src/engine.ts'));const files=[...visited].sort().map(f=>[f,hash(fs.readFileSync(path.join(repo,f)))]);
 return {sourceSHA256:hash(JSON.stringify(files)),recoveredNativeSourceSHA256:sourceFingerprint(),prefixSourceSHA256:prefixSource,files};
}
export async function load({build=true}={}){
 assert.equal(process.execArgv.filter(f=>/^--(?:no-)?maglev(?:=|$)/.test(f)).at(-1),'--no-maglev');const pinned=identity();
 const e=await loadEngines(build),dest=path.join(labRoot,'build/experiments/drop-counter/src/engine.js');
 if(build){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,stripTypeScriptTypes(fs.readFileSync(path.join(root,'src/engine.ts'),'utf8'),{mode:'transform'}));fs.writeFileSync(path.join(root,'build-identity.json'),JSON.stringify(pinned));}
 else assert.equal(JSON.parse(fs.readFileSync(path.join(root,'build-identity.json'))).sourceSHA256,pinned.sourceSHA256);
 const module=await import(pathToFileURL(dest).href);
 const resume=(env,side,delta,seed)=>{assert.equal(hash(JSON.stringify(env.payload)),env.sha256);assert.equal(env.payload.sourceIdentity,prefixSource);return module.resumeControlled(env.payload,side,delta,seed);};
 return {...e,identity:pinned,resume,simulateAdapter:module.simulateLabMatch};
}
export function metrics(result,env,side){
 const after=result.events.slice(env.payload.state.events.length),totals={shots:0,kicks:0,hands:0,completedKicks:0,completedHands:0},passes=new Map();
 for(const event of after){
  if(event.side===side){if(event.type==='shot')totals.shots++;if(['kick','hand_punch'].includes(event.type)&&event.playerId){const kind=event.type==='kick'?'kicks':'hands';totals[kind]++;passes.set(event.playerId,{kind,done:false});}}
  for(const credit of event.credits??[])if(credit.stat==='completedPasses'&&passes.has(credit.playerId)){const p=passes.get(credit.playerId);assert.ok(!p.done);p.done=true;totals[p.kind==='kicks'?'completedKicks':'completedHands']++;}
 }
 const ids=new Set(result.input.teams[side].players.map(p=>p.id));
 return {focalWin:Number(result.winner===side),focalScore:result.scores[side],opponentScore:result.scores[1-side],margin:result.scores[side]-result.scores[1-side],
  pointsFor:result.scores[side]-env.payload.state.score.scores[side],pointsAgainst:result.scores[1-side]-env.payload.state.score.scores[1-side],
  playingSecondsAfter:result.playingSeconds-env.payload.state.playing,elapsedSecondsAfter:result.elapsedSeconds-env.payload.state.elapsed,...totals,
  turnovers:after.flatMap(x=>x.credits??[]).filter(c=>c.stat==='turnovers'&&ids.has(c.playerId)).reduce((n,c)=>n+(c.amount??1),0),
  fouls:after.filter(x=>x.type==='foul'&&x.side===side).length,substitutions:after.filter(x=>x.type==='substitution'&&x.side===side).length};
}
export function auditFull(result,e){
 auditResult(result,e);assert.ok(!result.input.lab&&!result.input.weather);
 const players=new Map(result.input.teams.flatMap((t,side)=>t.players.map(p=>[p.id,{side,ratings:p.ratings,on:false,available:true,energy:1,stint:0}])));
 const tactics=result.input.teams.map(t=>({...t.coach.tactics})),penalties=[new Set(),new Set()];let playing=0,elapsed=0,decisions=0;
 for(const [i,event]of result.events.entries()){
  assert.equal(event.id,i+1);assert.ok(Math.abs(event.playingSeconds-playing)<1e-7);assert.ok(Math.abs(event.elapsedSeconds-elapsed)<1e-7);
  const side=event.side,p=event.playerId&&players.get(event.playerId);if(event.playerId)assert.equal(p.side,side);
  if(event.type==='lineup')for(const id of event.data.playerIds)players.get(id).on=true;
  if(event.type==='injury'){assert.ok(p.on);p.on=false;p.available=false;}
  if(event.type==='penalty_start'){assert.ok(p.on);p.on=false;penalties[side].add(event.playerId);}
  if(event.type==='penalty_end'){assert.ok(penalties[side].has(event.playerId));penalties[side].delete(event.playerId);if(event.data.returns){p.on=true;p.stint=0;}}
  if(event.type==='substitution'){assert.equal(event.data.authorized,true);assert.ok(p.available&&!p.on&&!penalties[side].has(event.playerId));if(event.otherPlayerId){assert.ok(players.get(event.otherPlayerId).on);players.get(event.otherPlayerId).on=false;}p.on=true;p.stint=0;}
  if(event.type==='halftime_decision'){decisions++;assert.equal(event.quarter,3);tactics[side]=event.data.effectiveTactics;assert.ok(Object.values(tactics[side]).every(x=>x>=1&&x<=5));}
  if(event.type==='time'){
   const dt=event.data.seconds,mode=event.data.mode;
   for(const s of [0,1]){const n=[...players.values()].filter(p=>p.side===s&&p.on).length;assert.ok(n<=15-penalties[s].size);if(mode==='playing')assert.ok(n>=result.config.minimumPlayers);}
   for(const p of players.values())if(mode==='playing'&&p.on){const t=tactics[p.side];p.energy=Math.max(.15,p.energy-dt*result.config.fatiguePerSecond*(.85+.07*t.pressure+.035*t.running_movement_emphasis+.02*t.physicality)*(1.5-p.ratings.stamina/25));p.stint+=dt;}
    else p.energy=Math.min(1,p.energy+dt*result.config.benchRecoveryPerSecond*(.6+p.ratings.recovery/20)*(mode==='interval'?.65:p.on?.18:1));
   elapsed+=dt;if(mode==='playing')playing+=dt;
  }
 }
 assert.equal(decisions,2);assert.ok(Math.abs(playing-result.playingSeconds)<1e-7&&Math.abs(elapsed-result.elapsedSeconds)<1e-7);
 for(const f of result.events.at(-1).data.finalCondition){const p=players.get(f.playerId);assert.equal(f.available,p.available);assert.ok(Math.abs(f.energy-p.energy)<1e-8);}
}
