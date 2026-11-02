import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { input } from './replay-runtime-probe.mjs';
import { simulateMatch } from '../packages/simulation-core/dist/match/engine.js';
import { compareMatchReplay, COORDINATE_REPLAY_POLICY, EXACT_REPLAY_POLICY } from '../packages/simulation-core/dist/competition/replay.js';

let checks=0;const check=x=>{assert.ok(x);checks++;};
const result=simulateMatch(input),json=JSON.parse(JSON.stringify(result));
check(compareMatchReplay(result,json).exact);
const eventIndex=result.events.findIndex(e=>e.y>10&&e.y<90);
const changed=(f)=>{const r=structuredClone(json);f(r);return r;};
const steps=(n,count)=>{const d=new DataView(new ArrayBuffer(8));d.setFloat64(0,n);d.setBigUint64(0,d.getBigUint64(0)+BigInt(count));return d.getFloat64(0);};
const within=changed(r=>r.events[eventIndex].y=steps(r.events[eventIndex].y,8));
check(!compareMatchReplay(json,within,EXACT_REPLAY_POLICY).equivalent);
const rounded=compareMatchReplay(json,within,COORDINATE_REPLAY_POLICY);
check(rounded.equivalent&&!rounded.exact&&rounded.coordinateDifferences===1&&rounded.maxCoordinateULPs===8);
check(!compareMatchReplay(json,changed(r=>r.events[eventIndex].y=steps(r.events[eventIndex].y,9)),COORDINATE_REPLAY_POLICY).equivalent);
const targetIndex=json.events.findIndex(e=>typeof e.data?.targetY==='number');
check(compareMatchReplay(json,changed(r=>r.events[targetIndex].data.targetY=steps(r.events[targetIndex].data.targetY,1)),COORDINATE_REPLAY_POLICY).equivalent);
const huge=changed(r=>{r.config.fieldWidth=1e6;r.events[eventIndex].y=1e5;});
const hugeReplay=structuredClone(huge);hugeReplay.events[eventIndex].y=steps(1e5,1);
check(!compareMatchReplay(huge,hugeReplay,COORDINATE_REPLAY_POLICY).equivalent); // One ULP still exceeds the absolute limit.
const outside=changed(r=>r.events[eventIndex].y=r.config.fieldWidth+1);
const outsideReplay=structuredClone(outside);outsideReplay.events[eventIndex].y=steps(outsideReplay.events[eventIndex].y,1);
check(!compareMatchReplay(outside,outsideReplay,COORDINATE_REPLAY_POLICY).equivalent);
for(const mutate of [
 r=>r.events[eventIndex].playingSeconds=steps(r.events[eventIndex].playingSeconds,1),
 r=>r.events[eventIndex].x=steps(r.events[eventIndex].x,1),
 r=>r.events[eventIndex].playerId='different-player',
 r=>r.events[eventIndex].id++,
 r=>r.events[eventIndex].data={...r.events[eventIndex].data,unknownCoordinate:1},
 r=>r.events.reverse(),r=>r.events.pop(),r=>r.scores[0]--,
 r=>r.players[0].stats.points=1+(r.players[0].stats.points??0),
 r=>r.players[0].secondsPlayed=steps(r.players[0].secondsPlayed,1),
 r=>r.input.teams[0].players[0].ratings.speed++,r=>r.seed+='changed',
 r=>r.events[eventIndex].y=NaN,r=>r.events[eventIndex].y=Infinity,
 r=>r.events[eventIndex].y=-Number.MIN_VALUE,
])check(!compareMatchReplay(json,changed(mutate),COORDINATE_REPLAY_POLICY).equivalent);
const invalid=changed(r=>r.events[eventIndex].y=NaN);check(!compareMatchReplay(invalid,invalid).equivalent);
assert.throws(()=>compareMatchReplay(json,json,'unknown-policy'),/Unknown/);checks++;
const original=JSON.stringify(json);compareMatchReplay(json,within,COORDINATE_REPLAY_POLICY);check(JSON.stringify(json)===original);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'century-replay-'));let crossRuntime;
try {
 const output=path.join(dir,'deno.json');
 const deno=spawnSync('npm',['exec','--yes','--package=deno@2.6.4','--','deno','run','--allow-read','--allow-write','scripts/replay-runtime-probe.mjs',output],{encoding:'utf8',timeout:60000});
 assert.equal(deno.status,0,deno.stderr);
 const other=JSON.parse(fs.readFileSync(output));
 crossRuntime={node:{node:process.version,v8:process.versions.v8},deno:other.runtime,...compareMatchReplay(json,other.result,COORDINATE_REPLAY_POLICY)};
 check(crossRuntime.equivalent);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log(JSON.stringify({checks,status:'passed',crossRuntime}));
