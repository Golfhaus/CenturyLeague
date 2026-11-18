// Semantic restoration of the previously tested graded policy. New source identity; lab only.
import {TACTIC_KEYS} from '../../../packages/simulation-core/src/match/types.js';
import type {MatchEvent,Side,Tactics} from '../../../packages/simulation-core/src/match/types.js';
import type {Ratings} from '../../../packages/simulation-core/src/types.js';
export const POLICY_VERSION='restored-halftime-policy-v2-boundary';
export type PolicyMode='hold'|'policy'|'aligned-diagnostic'|'mismatched-diagnostic';
export interface HalftimeSettings {sides:[PolicyMode,PolicyMode]}
export interface PublicTotals {shots:number;kicks:number;hands:number;completedKicks:number;completedHands:number}
export interface BeforeIntervalPlayer {id:string;energy:number;stint:number}
export interface DecisionObservation {side:Side;scores:[number,number];root:Tactics;ownOnField:{id:string;energy:number;ratings:Ratings}[];ownBeforeInterval?:BeforeIntervalPlayer[];publicTotals:[PublicTotals,PublicTotals];personnelReview:unknown}
export type Recipe='conserve'|'press'|'aerial'|'lower-aerial'|'drop-counter';
export interface Candidate {id:string;recipe:Recipe;step:number;tactics:Tactics;changedSliders:number;rootDistance:number;size:'modest'|'major';components:Record<string,number>;evidence:number;reliability:number;responseGain:number;estimatedBenefit:number;distanceCost:number;executionCost:number;workloadCost:number;netSupport:number;threshold:number;admissible:boolean;veto:string|null}
export interface Decision {policyVersion:string;side:Side;mode:PolicyMode;deficit:number;threshold:number;choice:string;effectiveTactics:Tactics;rootDistance:number;reason:string;candidates:Candidate[];observation:DecisionObservation;diagnosticAvailable:boolean}
export function validateSettings(settings?:HalftimeSettings):void {
 if(settings===undefined)return;
 const modes=['hold','policy','aligned-diagnostic','mismatched-diagnostic'];
 if(!settings||Object.keys(settings).some(k=>k!=='sides')||!Array.isArray(settings.sides)||settings.sides.length!==2||settings.sides.some(m=>!modes.includes(m)))throw Error('Invalid halftime settings');
}
export function publicTotals(events:MatchEvent[]):[PublicTotals,PublicTotals]{
 const totals=[0,1].map(()=>({shots:0,kicks:0,hands:0,completedKicks:0,completedHands:0})) as [PublicTotals,PublicTotals];
 const passes=new Map<string,{side:Side;kind:'kicks'|'hands';completed:boolean}>();
 for(const event of events){
  if(event.side!==undefined){if(event.type==='shot')totals[event.side].shots++;
   if((event.type==='kick'||event.type==='hand_punch')&&event.playerId){const kind=event.type==='kick'?'kicks':'hands';totals[event.side][kind]++;passes.set(event.playerId,{side:event.side,kind,completed:false});}}
  for(const credit of event.credits??[])if(credit.stat==='completedPasses'){
   const p=passes.get(credit.playerId);if(!p||p.completed||credit.amount!==undefined&&credit.amount!==1)throw Error('Completion lacks a unique public pass');
   totals[p.side][p.kind==='kicks'?'completedKicks':'completedHands']++;p.completed=true;}
 }
 return totals;
}
const clamp=(x:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,x));
const reliability=(n:number,prior:number)=>n/(n+prior);
const median=(xs:number[])=>{if(!xs.length)throw Error('Missing own on-field observation');const v=[...xs].sort((a,b)=>a-b),n=v.length;return n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2;};
export const adoptionThreshold=(deficit:number)=>deficit<=4?.12:deficit<=20?.06:.02;
export const rootDistance=(root:Tactics,effective:Tactics)=>TACTIC_KEYS.reduce((n,k)=>n+Math.abs(root[k]-effective[k]),0);
const order=(a:Candidate,b:Candidate)=>b.netSupport-a.netSupport||a.rootDistance-b.rootDistance||(a.id<b.id?-1:a.id>b.id?1:0);
export function evaluateCandidates(o:DecisionObservation):Candidate[]{
 const own=o.publicTotals[o.side],opp=o.publicTotals[1-o.side],deficit=o.scores[1-o.side]-o.scores[o.side],trailing=deficit>0;
 const med=median(o.ownOnField.map(p=>p.energy)),prior=o.ownBeforeInterval??[];
 const preFatigue=prior.length?clamp((1-median(prior.map(p=>p.energy)))/.85):0,postFatigue=clamp((1-med)/.85);
 const workloadNeed=Math.max(postFatigue,.75*preFatigue),intensity=clamp((o.root.tempo+o.root.pressure+o.root.running_movement_emphasis-9)/6);
 const shotReliability=reliability(own.shots+opp.shots,12),opportunityTrouble=own.shots+opp.shots?clamp((.5-own.shots/(own.shots+opp.shots))/.25)*shotReliability:0;
 const oppAttempts=opp.kicks+opp.hands,flowReliability=reliability(oppAttempts,20),opponentFlow=oppAttempts?clamp(((opp.completedKicks+opp.completedHands)/oppAttempts-.5)/.25)*flowReliability:0;
 const skill=(keys:(keyof Ratings)[])=>o.ownOnField.reduce((n,p)=>n+keys.reduce((v,k)=>v+p.ratings[k],0)/keys.length,0)/o.ownOnField.length;
 const fit=clamp((skill(['aerialMarking','verticalLeap','anticipation'])-skill(['handPassing','groundBallSkill','ballCarrying']))/.75,-1,1);
 const relative=(kind:'kicks'|'hands',completed:'completedKicks'|'completedHands')=>!own[kind]||!opp[kind]?0:(own[completed]/own[kind]-opp[completed]/opp[kind])*Math.min(reliability(own[kind],20),reliability(opp[kind],20));
 const routePerformance=clamp((relative('kicks','completedKicks')-relative('hands','completedHands'))/.25,-1,1),routeReliability=Math.min(...[own.kicks,opp.kicks,own.hands,opp.hands].map(n=>reliability(n,20))),highPressure=clamp((o.root.pressure-3)/2);
 const evidence:Record<Recipe,number>={conserve:workloadNeed*(.65+.35*intensity),press:.75*opportunityTrouble+.25*opponentFlow,aerial:.75*routePerformance+.25*fit,'lower-aerial':-.75*routePerformance-.25*fit,'drop-counter':highPressure*(.70*opportunityTrouble+.20*opponentFlow+.10*workloadNeed)};
 const certainty:Record<Recipe,number>={conserve:prior.length?.75:1,press:Math.max(shotReliability,flowReliability),aerial:routeReliability,'lower-aerial':routeReliability,'drop-counter':Math.max(shotReliability,flowReliability)};
 const components={opportunityTrouble,opponentFlow,routePerformance,personnelFit:fit,preFatigue,postFatigue,workloadNeed,rootIntensity:intensity,highPressure};
 const changes:Record<Recipe,Partial<Tactics>>={conserve:{tempo:-1,pressure:-1},press:{pressure:1,running_movement_emphasis:1},aerial:{aerial_emphasis:1,ball_risk:-1},'lower-aerial':{aerial_emphasis:-1,ball_risk:-1},'drop-counter':{pressure:-1,transition_emphasis:1}};
 const rows:Candidate[]=[],seen=new Set<string>();
 for(const recipe of Object.keys(changes) as Recipe[])for(const step of [.5,1]){
  const tactics={...o.root};for(const key of Object.keys(changes[recipe]) as (keyof Tactics)[])tactics[key]=clamp(tactics[key]+changes[recipe][key]!*step,1,5);
  const changedSliders=TACTIC_KEYS.filter(k=>tactics[k]!==o.root[k]).length,distance=rootDistance(o.root,tactics),maxDelta=Math.max(...TACTIC_KEYS.map(k=>Math.abs(o.root[k]-tactics[k]))),signature=JSON.stringify(tactics);
  if(!changedSliders||seen.has(signature))continue;seen.add(signature);
  const size=maxDelta>.5||distance>1?'major':'modest',responseDelta=recipe==='aerial'||recipe==='lower-aerial'?Math.abs(tactics.aerial_emphasis-o.root.aerial_emphasis):maxDelta,responseGain=responseDelta<=.5?1.3*responseDelta:.65+.7*(responseDelta-.5),estimatedBenefit=evidence[recipe]*responseGain;
  const distanceCost=.10*distance,executionCost=.06*changedSliders+.06*distance*distance,workloadCost=recipe==='press'?.25*postFatigue*maxDelta:0,threshold=size==='major'?Math.max(.12,adoptionThreshold(deficit)):adoptionThreshold(deficit);
  let veto:string|null=null;
  if((recipe==='aerial'||recipe==='lower-aerial')&&responseDelta===0)veto='primary-lever-at-bound';else if(recipe==='press'&&!trailing)veto='not-trailing';else if(recipe==='press'&&med<.45)veto='energy-below-veto';else if(recipe==='drop-counter'&&highPressure===0)veto='root-not-high-pressure';else if(evidence[recipe]<.25)veto='insufficient-directional-evidence';else if(size==='major'&&(evidence[recipe]<.65||certainty[recipe]<.45))veto='major-change-needs-stronger-evidence';
  rows.push({id:recipe+'-'+step,recipe,step,tactics,changedSliders,rootDistance:distance,size,components:{...components},evidence:evidence[recipe],reliability:certainty[recipe],responseGain,estimatedBenefit,distanceCost,executionCost,workloadCost,netSupport:estimatedBenefit-distanceCost-executionCost-workloadCost,threshold,admissible:veto===null,veto});
 }
 return rows.sort(order);
}
export function decideHalftime(observation:DecisionObservation,mode:PolicyMode):Decision{
 const o=JSON.parse(JSON.stringify(observation)) as DecisionObservation,deficit=o.scores[1-o.side]-o.scores[o.side],threshold=adoptionThreshold(deficit),candidates=evaluateCandidates(o),admissible=candidates.filter(c=>c.admissible);
 let selected:Candidate|undefined,diagnosticAvailable=false,reason='disabled-control';
 if(mode==='policy'){selected=admissible.find(c=>c.netSupport>c.threshold);reason=selected?'supported-change':'insufficient-net-support';}
 else if(mode==='aligned-diagnostic'||mode==='mismatched-diagnostic'){
  const diagnostic=candidates.filter(c=>!['not-trailing','energy-below-veto','root-not-high-pressure','primary-lever-at-bound'].includes(c.veto??'')),aligned=diagnostic[0];
  const opposite:Record<Recipe,Recipe>={conserve:'press',press:'conserve',aerial:'lower-aerial','lower-aerial':'aerial','drop-counter':'press'},mismatched=aligned&&diagnostic.find(c=>c.recipe===opposite[aligned.recipe]&&c.step===aligned.step);
  diagnosticAvailable=Boolean(aligned&&mismatched);if(diagnosticAvailable)selected=mode==='aligned-diagnostic'?aligned:mismatched;reason=diagnosticAvailable?'input-defined-diagnostic':'diagnostic-pair-unavailable';
 }
 return {policyVersion:POLICY_VERSION,side:o.side,mode,deficit,threshold,choice:selected?.id??'hold',effectiveTactics:selected?.tactics??{...o.root},rootDistance:selected?.rootDistance??0,reason,candidates,observation:o,diagnosticAvailable};
}
