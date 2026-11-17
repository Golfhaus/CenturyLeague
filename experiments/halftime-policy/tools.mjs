import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{stripTypeScriptTypes}from'node:module';import{fileURLToPath,pathToFileURL}from'node:url';
import{loadEngines,verifyBaseline,verifyImportBoundary,sourceFingerprint,hash,atomicJSON,inputFor,labRoot,auditResult}from'../v2/tools.mjs';
import{auditFull as auditPhysical}from'../drop-counter/tools.mjs';
export{hash,atomicJSON,inputFor,auditResult,auditPhysical};
export const root=fileURLToPath(new URL('.',import.meta.url)),repo=path.resolve(root,'../..');
export function identity(){
 verifyBaseline();verifyImportBoundary();assert.equal(sourceFingerprint(),'ad8492b0fccbf45e730dffe941d9476e39c5e1d386aedbc31ac524237bbb7329');
 const visited=new Set();
 const visit=file=>{const rel=path.relative(repo,file);assert.ok(rel.startsWith('packages/simulation-core/src/')||['experiments/halftime-policy/src/engine.ts','experiments/halftime-policy/src/policy.ts','experiments/v2/src/streaks.ts','experiments/v2/src/weather.ts'].includes(rel));if(visited.has(rel))return;visited.add(rel);
  const s=fs.readFileSync(file,'utf8');assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|require)\s*\(|\bimport\s*\(/.test(s));for(const m of s.matchAll(/\b(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){assert.ok(m[1].startsWith('.'));visit(path.resolve(path.dirname(file),m[1].replace(/\.js$/,'.ts')));}};
 visit(path.join(root,'src/engine.ts'));const files=[...visited].sort().map(f=>[f,hash(fs.readFileSync(path.join(repo,f)))]);return{sourceSHA256:hash(JSON.stringify(files)),nativeSourceSHA256:sourceFingerprint(),files};
}
export async function load({build=true}={}){
 assert.equal(process.execArgv.filter(f=>/^--(?:no-)?maglev(?:=|$)/.test(f)).at(-1),'--no-maglev');const pinned=identity(),e=await loadEngines(build),out=path.join(labRoot,'build/experiments/halftime-policy/src');
 if(build){fs.mkdirSync(out,{recursive:true});for(const name of ['engine','policy'])fs.writeFileSync(path.join(out,name+'.js'),stripTypeScriptTypes(fs.readFileSync(path.join(root,'src',name+'.ts'),'utf8'),{mode:'transform'}));fs.writeFileSync(path.join(root,'build-identity.json'),JSON.stringify(pinned));}
 else assert.equal(JSON.parse(fs.readFileSync(path.join(root,'build-identity.json'))).sourceSHA256,pinned.sourceSHA256);
 const [engine,policy]=await Promise.all([import(pathToFileURL(path.join(out,'engine.js')).href),import(pathToFileURL(path.join(out,'policy.js')).href)]);
 return{...e,...policy,identity:pinned,simulate:engine.simulateLabMatch};
}
export function stripDecisionEvents(result){
 return {winner:result.winner,scores:result.scores,playingSeconds:result.playingSeconds,elapsedSeconds:result.elapsedSeconds,quarters:result.quarters,players:result.players,teamStats:result.teamStats,
  events:result.events.filter(x=>x.type!=='halftime_decision').map(({id,...rest})=>rest)};
}
