import fs from 'node:fs';import assert from 'node:assert/strict';import {hash,identity,atomicJSON} from '../halftime-policy/tools.mjs';import {root,planFile,fingerprint} from './spec.mjs';
const file=process.argv[2],original=JSON.parse(fs.readFileSync(file)),out=root+'profiles.json';assert.ok(!fs.existsSync(planFile)&&!fs.existsSync(out));
const air=['aerialMarking','verticalLeap','anticipation'],ground=['handPassing','groundBallSkill','ballCarrying'];
const contexts=[
 {id:'aerial-fit-low-root',fit:1,focal:{aerial_emphasis:1,ball_risk:4},opponent:{aerial_emphasis:5,pressure:4}},
 {id:'ground-fit-high-root',fit:-1,focal:{aerial_emphasis:5,ball_risk:4},opponent:{aerial_emphasis:1,pressure:4}},
 {id:'aerial-fit-high-root',fit:1,focal:{aerial_emphasis:5},opponent:{aerial_emphasis:1,pressure:4}},
 {id:'ground-fit-low-root',fit:-1,focal:{aerial_emphasis:1},opponent:{aerial_emphasis:5,pressure:4}},
 {id:'high-press-versus-counter',focal:{pressure:5,tempo:4,running_movement_emphasis:5,transition_emphasis:1},opponent:{defensive_posture:4,pressure:1,transition_emphasis:5}},
 {id:'low-press-versus-flow',focal:{pressure:1,running_movement_emphasis:2},opponent:{pressure:2,tempo:4,width:4,transition_emphasis:4}},
 {id:'fatigue-high-load-short-bench',fatigue:true,eligibleFocal:20,focal:{pressure:5,tempo:5,running_movement_emphasis:5}},
 {id:'fatigue-managed-short-bench',fatigue:true,eligibleFocal:20,focal:{pressure:2,tempo:2,running_movement_emphasis:2}},
 {id:'fatigue-high-load-deep-bench',fatigue:true,focal:{pressure:5,tempo:5,running_movement_emphasis:5}},
 {id:'neutral-matched'}, {id:'neutral-weaker',gap:.35}, {id:'neutral-stronger',gap:-.35}];
const profiles=[];
for(const context of contexts)for(let template=1;template<=4;template++){
 const source=original.profiles.find(p=>p.id===`quality-${template}-zero-neutral`);assert.ok(source);const teams=structuredClone(source.teams);
 if(context.fit)for(const p of teams[0].players){for(const k of air)p.ratings[k]+=2*context.fit;for(const k of ground)p.ratings[k]-=2*context.fit;}
 if(context.fatigue)for(const p of teams[0].players){p.ratings.stamina=2;p.ratings.recovery=1;}
 if(context.gap)for(const p of teams[1].players)for(const k of Object.keys(p.ratings))p.ratings[k]+=context.gap;
 for(let side=0;side<2;side++)Object.assign(teams[side].coach.tactics,context[side===0?'focal':'opponent']??{});
 for(const t of teams)for(const p of t.players)assert.ok(Object.values(p.ratings).every(v=>v>=1&&v<=20));
 profiles.push({id:context.id+'-template-'+template,context:context.id,template,eligibleFocal:context.eligibleFocal??35,teams});
}
atomicJSON(out,{schema:'halftime-targeted-profiles-v1',upstreamSHA256:hash(fs.readFileSync(file)),contexts,profiles},true);
const fixtures=profiles.flatMap(p=>Array.from({length:8},(_,trial)=>({id:p.id+'-fresh-'+String(trial).padStart(2,'0'),profile:p.id,context:p.context,template:p.template,trial,focalSide:trial%2,seed:hash('century-halftime-decision-review-fresh-v1:'+p.id+':'+trial)})));
atomicJSON(planFile,{studyId:'halftime-decision-quality-v1',sourceSHA256:identity().sourceSHA256,harnessSHA256:fingerprint(),profilesSHA256:hash(fs.readFileSync(out)),arms:['hold','policy'],fixtures,
 primary:{estimand:'Pre-match focal policy minus Hold win probability averaged over this fixed targeted matrix, including no-op decisions.',interval:'Two-sided conservative 95% Hoeffding bound for independent heterogeneous bounded paired differences; half-width 100*sqrt(2*log(2/.05)/384).'},
 interpretation:'384 paired cases/768 outcomes. Descriptive contexts, deficit bands, recipes and side splits; do not pool historical natural-history studies. No target adoption rate, no winner-based tuning. Assumed tactical fit is a scenario label, not an oracle of the best action. Correlated common-seed post-change trajectories may diverge; a single changed winner does not identify expected action harm.',
 fatigue:'Native within-match fatigue and native intervals; no artificial energy injection or changed physical coefficients. Low stamina=2/recovery=1, 20 eligible via declared synthetic fixture absences or full35; remaining ratings preserved. Does not model cross-match fatigue carry-over.',
 operations:{workers:2,chunk:8,chunkDeadlineSeconds:900,automaticRetries:0,seedReplacements:0,sampleExtensions:0,preflightOutcomesExcluded:4,replayTrial:0,officialWrites:false},
 gates:['All physical/observation/first-half/no-op/replay checks pass.','Inspect fit/public-evidence conflict and missing context coverage without treating losses as proof of bad choices.','Do not declare policy settled solely from this finite matrix or move to holistic if a material decision-quality issue remains.']},true);console.log(JSON.stringify({status:'frozen',profiles:profiles.length,cases:fixtures.length,source:identity().sourceSHA256,harness:fingerprint()}));
