import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {hash,inputFor,identity} from '../halftime-policy/tools.mjs';
import {harnessFingerprint as priorHarness} from '../halftime-policy/spec.mjs';
export const root=fileURLToPath(new URL('.',import.meta.url)),repo=path.resolve(root,'../..');
export const planFile=path.join(repo,'docs/halftime-decision-quality-plan-2026-11-17.json');
export const fingerprint=()=>hash(JSON.stringify({priorHarness:priorHarness(),files:['spec.mjs','make-plan.mjs','historical.mjs','run.mjs','worker.mjs','audit.mjs','analyze.mjs','recompute.py'].map(f=>[f,hash(fs.readFileSync(path.join(root,f)))])}));
export const loadPlan=()=>JSON.parse(fs.readFileSync(planFile));
export function inputForCase(e,profile,fixture,arm){
 const teams=structuredClone(profile.teams);if(fixture.focalSide===1)teams.reverse();const b=inputFor(e,teams,fixture.id,fixture.seed,'2026-11-17');
 if(profile.eligibleFocal<35){const missing=teams[fixture.focalSide].players.slice(profile.eligibleFocal);b.availability=e.pinAvailability(b,'men','2026-11-17',missing.map(p=>({id:'synthetic-absence-'+p.id,playerId:p.id,sourceResultId:'fixture-design-only',startsOn:'2026-11-16',recoveredOn:'2026-11-19'})),[]);}
 const sides=['hold','hold'];if(arm==='policy')sides[fixture.focalSide]='policy';return {...b,halftime:{sides}};
}
export function rowFor(e,result,fixture,arm){
 const d=result.halftimeTelemetry.decisions[fixture.focalSide],o=d.observation,c=d.candidates.find(c=>c.id===d.choice),components=d.candidates[0].components,median=xs=>{const a=[...xs].sort((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
 const end=result.events.findIndex(x=>x.type==='quarter_end'&&x.quarter===2)+1;
 return {fixture:fixture.id,context:fixture.context,template:fixture.template,trial:fixture.trial,focalSide:fixture.focalSide,arm,focalWin:Number(result.winner===fixture.focalSide),margin:result.scores[fixture.focalSide]-result.scores[1-fixture.focalSide],halfDeficit:d.deficit,choice:d.choice,rootDistance:d.rootDistance,
 medianEnergy:median(o.ownOnField.map(p=>p.energy)),medianPreEnergy:median(o.ownBeforeInterval.map(p=>p.energy)),netSupport:c?.netSupport??0,threshold:c?.threshold??d.threshold,personnelFit:components.personnelFit,routePerformance:components.routePerformance,workloadNeed:components.workloadNeed,
 firstHalfSHA256:hash(JSON.stringify(result.events.slice(0,end))),resultSHA256:hash(JSON.stringify(result))};
}
export function assertIdentity(manifest){if(identity().sourceSHA256!==manifest.sourceSHA256||fingerprint()!==manifest.harnessSHA256)throw Error('Pinned source/harness changed');}
