import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {hash,inputFor,identity} from '../halftime-boundary/tools.mjs';import {harnessFingerprint as legacyHarness} from '../halftime-policy/spec.mjs';
export const root=fileURLToPath(new URL('.',import.meta.url)),repo=path.resolve(root,'../..');
export const planFile=path.join(repo,'docs/halftime-moderate-workload-plan-2026-11-18.json');
const files=['spec.mjs','make-plan.mjs','run.mjs','worker.mjs','audit.mjs','analyze.mjs','recompute.py','../halftime-boundary/tools.mjs','../halftime-policy/audit-result.mjs','../drop-counter/storage.mjs','../v2/runtime.mjs'];
export const fingerprint=()=>hash(JSON.stringify({legacyHarness:legacyHarness(),files:files.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))])}));
export const loadPlan=()=>JSON.parse(fs.readFileSync(planFile));
export function assertIdentity(m){assert.equal(identity().sourceSHA256,m.sourceSHA256);assert.equal(fingerprint(),m.harnessSHA256);}
export function inputForCase(e,profile,fixture,arm){
 const teams=structuredClone(profile.teams);if(fixture.focalSide===1)teams.reverse();const input=inputFor(e,teams,fixture.id,fixture.seed,'2026-11-18');
 const missing=teams.flatMap(t=>t.players.slice(profile.eligibleEach));
 input.availability=e.pinAvailability(input,'men','2026-11-18',missing.map(p=>({id:'synthetic-moderate-absence-'+p.id,playerId:p.id,sourceResultId:'synthetic-matched-availability-fixture',startsOn:'2026-11-17',recoveredOn:'2026-11-20'})),[]);
 const sides=['hold','hold'];if(arm==='policy')sides[fixture.focalSide]='policy';else assert.equal(arm,'hold');return {...input,halftime:{sides}};
}
const median=xs=>{const a=[...xs].sort((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
export function rowFor(e,result,f,arm){
 const d=result.halftimeTelemetry.decisions[f.focalSide],o=d.observation,c=d.candidates.find(c=>c.id===d.choice),components=d.candidates[0].components,end=result.events.findIndex(x=>x.type==='quarter_end'&&x.quarter===2)+1,half=result.events[end-1];
 const sideById=new Map(result.input.teams.flatMap((t,side)=>t.players.map(p=>[p.id,side]))),final=result.events.at(-1).data.finalCondition;
 const energy=side=>final.filter(p=>sideById.get(p.playerId)===side).map(p=>p.energy),mean=xs=>xs.reduce((n,v)=>n+v,0)/xs.length;
 return {fixture:f.id,context:f.context,template:f.template,trial:f.trial,focalSide:f.focalSide,arm,eligibleEach:f.eligibleEach,rootWorkload:f.rootWorkload,gap:f.gap,focalWin:Number(result.winner===f.focalSide),margin:result.scores[f.focalSide]-result.scores[1-f.focalSide],halfDeficit:d.deficit,choice:d.choice,rootDistance:d.rootDistance,
 medianEnergy:median(o.ownOnField.map(p=>p.energy)),medianPreEnergy:median(o.ownBeforeInterval.map(p=>p.energy)),netSupport:c?.netSupport??0,threshold:c?.threshold??d.threshold,personnelFit:components.personnelFit,routePerformance:components.routePerformance,workloadNeed:components.workloadNeed,
 secondHalfPlayingSeconds:result.playingSeconds-half.playingSeconds,focalFinalMeanEnergy:mean(energy(f.focalSide)),opponentFinalMeanEnergy:mean(energy(1-f.focalSide)),firstHalfSHA256:hash(JSON.stringify(result.events.slice(0,end))),resultSHA256:hash(JSON.stringify(result))};
}
