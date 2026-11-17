import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{Worker}from'node:worker_threads';
import{load,root,repo,hash,atomicJSON,readGzip}from'./tools.mjs';import{ensureQualifiedStudyProcess,qualifyStudyRuntime}from'../v2/runtime.mjs';
ensureQualifiedStudyProcess();const runtime=qualifyStudyRuntime(),[dataArg,outArg]=process.argv.slice(2);assert.ok(dataArg&&outArg);
const dataDir=path.resolve(dataArg),out=path.resolve(outArg);assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});const e=await load();
const normalize=s=>s.replace(/\n\s*\n/g,'\n').trim();
let native=fs.readFileSync(path.join(root,'src/engine.ts'),'utf8')
 .replaceAll("from '../../v2/src/streaks.js'","from './streaks.js'").replaceAll("from '../../v2/src/weather.js'","from './weather.js'")
 .replace(/\n\/\*\* Explicit laboratory continuation[\s\S]*?(?=\nclass AvailabilityMatch)/,'\n')
 .replace(/  restoreControlled\(snapshot:any,[\s\S]*?(?=  private on\()/,'')
 .replace("private rng;\n  private restored = false;\n  private effectiveTactics: CompetitiveMatchInput['teams'][0]['coach']['tactics'][];",'private readonly rng;')
 .replace('    this.effectiveTactics = input.teams.map(t => ({...t.coach.tactics}));\n','')
 .replace('return this.effectiveTactics[side][key];','return this.input.teams[side].coach.tactics[key];')
 .replace("    if (!this.restored) {\n      this.emit('match_start', { data: { engineVersion: MATCH_ENGINE_VERSION, seed: this.input.seed } });\n      this.lineup(); this.ballUp(true);\n    }", "    this.emit('match_start', { data: { engineVersion: MATCH_ENGINE_VERSION, seed: this.input.seed } });\n    this.lineup(); this.ballUp(true);");
assert.equal(normalize(native),normalize(fs.readFileSync(path.join(repo,'experiments/v2/src/engine.ts'),'utf8')),'Native engine changed beyond declared intervention/restore wiring');
const m=JSON.parse(fs.readFileSync(path.join(dataDir,'study/manifest.json'))),summary=JSON.parse(fs.readFileSync(path.join(dataDir,'study/summary.json')));
let defaultOffComparisons=0;for(const p of [m.prefixes[0],m.prefixes[12],m.prefixes[24],m.prefixes[36]]){
 const env=readGzip(path.join(dataDir,'prefixes',p.file));assert.deepEqual(e.simulateAdapter(env.payload.input),e.simulateV2(env.payload.input));defaultOffComparisons++;
}
let matchedClusters=0,matchedOutcomes=0;
for(let start=0;start<summary.records.length;start+=8){
 const chunk=summary.records.slice(start,start+8),workers=[];let next=0,finished=0,failed=false;
 try{await new Promise((resolve,reject)=>{
  const fail=err=>{if(!failed){failed=true;clearTimeout(timer);reject(err);}},timer=setTimeout(()=>fail(Error('Recovery qualification chunk exceeded 900 seconds')),900000);
  for(let i=0;i<2;i++){const w=new Worker(new URL('./qualify-worker.mjs',import.meta.url),{workerData:{dataDir}});workers.push(w);w.on('error',fail);w.on('exit',code=>{if(!failed&&finished<chunk.length)fail(Error('Qualification worker exited '+code));});
   w.on('message',msg=>{if(failed)return;if(msg.error){fail(Error(msg.error));return;}finished++;matchedClusters++;matchedOutcomes+=msg.matchedMetrics;
    atomicJSON(path.join(out,'progress.json'),{matchedClusters,matchedOutcomes,total:1248});console.log(JSON.stringify({matchedClusters,matchedOutcomes,total:1248}));
    if(finished===chunk.length){clearTimeout(timer);resolve();}else if(next<chunk.length)w.postMessage(chunk[next++]);});
   if(next<chunk.length)w.postMessage(chunk[next++]);}
 });}finally{await Promise.all(workers.map(w=>w.terminate()));}
}
assert.equal(matchedOutcomes,1248);assert.equal(matchedClusters,96);
const sample=readGzip(path.join(dataDir,'prefixes',m.prefixes.find(p=>p.tactics==='pressure'&&p.trailingSide===0).file));let invalidCasesRejected=0;
for(const delta of [{pressure:.5},{pressure:NaN},{unknown:.5},{pressure:0},{pressure:-.5,tempo:-.5,ball_risk:-.5}]){assert.throws(()=>e.resume(sample,0,delta,'invalid-recovery-case'));invalidCasesRejected++;}
const bad=structuredClone(sample);bad.payload.state.playing++;assert.throws(()=>e.resume(bad,0,{},'invalid-hash'));invalidCasesRejected++;
atomicJSON(path.join(out,'qualification.json'),{status:'passed',source:e.identity,runtime,nativeGameplayEquivalence:true,defaultOffComparisons,matchedHistoricalClusters:96,matchedHistoricalOutcomes:1248,
 fieldsPerOutcome:16,invalidCasesRejected,oldStudySHA256:hash(fs.readFileSync(path.join(dataDir,'study/manifest.json'))),
 limitations:'Recovered adapter has a new source identity. Historical agreement is on every saved score/clock/action-count compact metric, not byte-identical full historical events or missing historical policy telemetry. Every generated qualification ledger was independently audited. Old scientific estimates remain unchanged; qualification outcomes are excluded from new data.'});
console.log(JSON.stringify({status:'passed',matchedHistoricalOutcomes:1248,defaultOffComparisons,invalidCasesRejected}));
