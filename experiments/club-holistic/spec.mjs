import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath}from'node:url';
import{hash,identity}from'../halftime-boundary/tools.mjs';import{fingerprint as upstreamFingerprint,inputForCase as baseInput,rowFor as baseRow}from'../holistic/spec.mjs';
export const root=fileURLToPath(new URL('.',import.meta.url)),ARMS=['000','110','111'],SCENES=['ordinary','hot-favored','cold-adverse'];
const files=['spec.mjs','prepare.mjs','qualify.mjs','make-plan.mjs','run.mjs','worker.mjs','audit.mjs','analyze.mjs','recompute.py'];
export const fingerprint=()=>hash(JSON.stringify({upstream:upstreamFingerprint(),files:files.map(f=>[f,hash(fs.readFileSync(root+f))])}));
let cachedData;export const data=()=>cachedData??=JSON.parse(fs.readFileSync(root+'profiles.json'));
export function loadProfiles(){const d=data(),teams=new Map(d.teams.map(t=>[t.id,t]));return d.profiles.map(p=>({...p,teams:p.teamIds.map(id=>teams.get(id))}));}
export function assertIdentity(m){assert.equal(identity().sourceSHA256,m.sourceSHA256);assert.equal(fingerprint(),m.harnessSHA256);assert.equal(hash(fs.readFileSync(root+'profiles.json')),m.profilesSHA256);}
// Unbiased mapping from a separate 256-bit SHA domain; rehashing rejects only
// incomplete integer buckets, never a team, seed, result or unfavorable draw.
export function draw(domain,n){const size=1n<<256n,limit=size-size%BigInt(n);for(let attempt=0;;attempt++){const sha=hash(domain+':'+attempt),x=BigInt('0x'+sha);if(x<limit)return{index:Number(x%BigInt(n)),sha256:sha,attempt};}}
export function fixture(scene,trial,namespace='club-holistic-precision-fresh-v1'){
 const d=data(),domain=namespace+':'+scene+':'+trial,p=draw(domain+':pair',d.profiles.length),h=draw(domain+':history',d.histories.length),side=draw(domain+':orientation',2),profile=d.profiles[p.index];
 return{id:`${namespace}-${scene}-${trial}`,profile:profile.id,template:p.index,gap:profile.gap,tactics:'authentic',scene,trial,focalSide:side.index,historyIndex:h.index,matchDate:d.histories[h.index].evaluationDate,seed:hash(domain+':gameplay'),draws:{pair:p,history:h,orientation:side},replay:trial<8};
}
export function inputForCase(e,p,f,arm){
 assert.ok(ARMS.includes(arm));const input=baseInput(e,p,f,arm),history=data().histories[f.historyIndex];assert.ok(history);input.availability.matchDate=f.matchDate;
 if(input.lab&&f.scene==='ordinary')input.lab.streaks=input.teams.map(t=>history.streaks[t.id]);
 input.provenance={...input.provenance,study:'copied-club-holistic-precision-v1',rosterHistorySHA256:hash(fs.readFileSync(root+'profiles.json')),historyIndex:f.historyIndex,historyFixtureIds:history.fixtureIds,availabilityScope:'healthy reset; no injury/suspension/carryover claim',streakScope:f.scene==='ordinary'?'copied accepted competitive prefix':'counterfactual extreme +/-5'};
 return input;
}
export function rowFor(r,f,arm){const x=baseRow(r,f,arm),history=data().histories[f.historyIndex],focal=r.input.teams[f.focalSide],opponent=r.input.teams[1-f.focalSide];return{...x,focalTeamId:focal.id,opponentTeamId:opponent.id,historyIndex:f.historyIndex,historyStreakFocal:history.streaks[focal.id],historyStreakOpponent:history.streaks[opponent.id],matchDate:f.matchDate};}
export const prefixGroup=arm=>arm.slice(0,2);
