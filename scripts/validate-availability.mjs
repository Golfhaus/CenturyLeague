import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import { input as fictionalInput } from './replay-runtime-probe.mjs';
import { simulateMatch } from '../packages/simulation-core/dist/match/engine.js';
import { competitionJSON } from '../packages/simulation-core/dist/competition/index.js';
import { compareMatchReplay, COORDINATE_REPLAY_POLICY } from '../packages/simulation-core/dist/competition/replay.js';
import { candidateProbe } from './availability-runtime-probe.mjs';
import { createOperations, prepareCompetitiveInput, availabilityFor, simulateCompetitiveMatch, executeOperation, operationsView,
 CANDIDATE_RECOVERY_POLICY, calendarDate, addCalendarDays, recoveryDays, validateCompetitiveInput, operationsTeamRecords } from '../packages/simulation-core/dist/competitive/index.js';

let checks=0;const check=x=>{assert.ok(x);checks++;};const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
const rejects=(f,p)=>{assert.throws(f,p);checks++;};
const actor={id:'commissioner',role:'commissioner'},at='2026-11-01T12:00:00Z';
const policy={id:'fixed-two-days-test',bands:[{weight:1,minimumDays:2,maximumDays:2}]};
let state=createOperations('men',policy);
const base=(id,seed='availability-2',competitionId='comp-a',injuryChance=0.004)=>({...structuredClone(fictionalInput),id,seed,
 config:{injuryChancePerContest:injuryChance},provenance:{classification:'competitive',competitionId,competitionCategory:'men'}});
const command=(id,operation)=>({id,expectedRevision:state.revision,at,operation});
const apply=(id,operation,context)=>{const c=command(id,operation);const done=executeOperation(state,c,actor,context);state=done.state;return {c,...done};};
const accept=(id,result,competitionId,date,replaces)=>apply(id,{type:'accept',proposalId:'proposal-'+id,
 resultSHA256:createHash('sha256').update(competitionJSON(result)).digest('hex'),competitionId,matchDate:date,...(replaces?{replaces}:{})},{result});
const pristine=prepareCompetitiveInput(state,base('healthy','healthy','comp-a',0),'2026-10-31');
const legacy=simulateMatch(pristine),adapted=simulateCompetitiveMatch(pristine);
const comparable=structuredClone(adapted);comparable.engineVersion=legacy.engineVersion;comparable.events[0].data.engineVersion=legacy.engineVersion;
equal(comparable,legacy); // Healthy input has exactly the frozen sporting behavior, not merely the same winner.
check(adapted.players.length===70);
equal(addCalendarDays('2026-10-31',2),'2026-11-02');equal(addCalendarDays('2028-02-28',1),'2028-02-29');
rejects(()=>calendarDate('2026-02-30'),/calendar/);rejects(()=>calendarDate('2026-11-01T00:00:00Z'),/calendar/);
rejects(()=>addCalendarDays('2026-10-31',-1),/duration/);
const durations=Array.from({length:1000},(_,i)=>recoveryDays(CANDIDATE_RECOVERY_POLICY,'sample-'+i,1,'p'));
check(durations.every(d=>d>=1&&d<=28));check(durations.filter(d=>d<=3).length>700);check(durations.filter(d=>d>10).length>0);
equal(recoveryDays(policy,'seed',17,'p'),recoveryDays(policy,'seed',17,'p'));
rejects(()=>createOperations('men',{id:'bad',bands:[{weight:1,minimumDays:0,maximumDays:3}]}),/policy/);
const initial=structuredClone(state),original=simulateCompetitiveMatch(prepareCompetitiveInput(state,base('original'),'2026-10-31'));
check(original.events.some(e=>e.type==='injury')&&original.events.some(e=>e.type==='foul'&&e.data.serious));
check(original.events.filter(e=>e.type==='injury').every(e=>e.data.persistsAfterMatch===true));
const first=accept('accepted-original',original,'comp-a','2026-10-31');
const firstEvidence=first.event.accepted,injured=firstEvidence.injuries[0].playerId;
equal(firstEvidence.injuries[0].recoveredOn,'2026-11-02');check(firstEvidence.discipline.length>0);
check(operationsView(state).suspensions.length===0); // Serious flag is a review, never an invented automatic offense/ban.
const sourceCase=firstEvidence.discipline.find(c=>!firstEvidence.injuries.some(i=>i.playerId===c.playerId));check(Boolean(sourceCase));
const retry=executeOperation(state,first.c,actor,{result:original});check(!retry.added&&retry.state===state);
rejects(()=>executeOperation(state,{...first.c,operation:{...first.c.operation,competitionId:'different'}},actor),/Conflicting/);
rejects(()=>executeOperation(state,command('viewer-attempt',{type:'discipline',caseId:sourceCase.id,matches:2,reason:'Serious incident assessed from source evidence'}),{id:'viewer',role:'viewer'}),/Commissioner/);
rejects(()=>executeOperation(state,{...command('stale',{type:'close',competitionId:'comp-a',reason:'Competition fixtures completed'}),expectedRevision:0},actor),/Stale/);
rejects(()=>executeOperation(initial,{...first.c,operation:{...first.c.operation,matchDate:'2026-11-01'}},actor,{result:original}),/scope/);
const forged=structuredClone(original);forged.scores[0]--;
rejects(()=>executeOperation(initial,first.c,actor,{result:forged}),/replay/);
rejects(()=>executeOperation(initial,first.c,actor,{result:legacy}),/Versioned/); // Exhibition results cannot create absences or serve bans.
apply('ban-two',{type:'discipline',caseId:sourceCase.id,matches:2,reason:'Commissioner assessed the recorded serious incident'});
check(operationsView(state).suspensions[0].matches===2);
rejects(()=>executeOperation(state,command('duplicate-decision',{type:'discipline',caseId:sourceCase.id,matches:2,reason:'Another decision for the same recorded incident'}),actor),/Undecided/);
const nextInput=base('november-fixture','availability-next','comp-b',0);nextInput.teams[0].id='transfer-club';nextInput.teams[0].name='Transferred club';
const next=prepareCompetitiveInput(state,nextInput,'2026-11-01');
check(!next.availability.players.find(p=>p.playerId===injured).eligible);
check(!next.availability.players.find(p=>p.playerId===sourceCase.playerId).eligible);
const nextResult=simulateCompetitiveMatch(next);check(nextResult.players.length===70);
for(const id of [injured,sourceCase.playerId]){
 const p=nextResult.players.find(p=>p.id===id);check(p.secondsPlayed===0&&Object.keys(p.stats).length===0);
 check(!nextResult.events.some(e=>e.playerId===id||e.otherPlayerId===id||(e.type==='lineup'&&e.data.playerIds.includes(id))));
}
accept('accepted-next',nextResult,'comp-b','2026-11-01');
equal(operationsView(state).suspensions[0].servedBy,['accepted-next']); // Transfer and monthly-season boundary do not reset the ban.
const recoveryInput=prepareCompetitiveInput(state,base('recovery-fixture','availability-recovery','comp-b',0),'2026-11-02');
check(recoveryInput.availability.players.find(p=>p.playerId===injured).eligible);
check(!recoveryInput.availability.players.find(p=>p.playerId===sourceCase.playerId).eligible);
accept('accepted-recovery',simulateCompetitiveMatch(recoveryInput),'comp-b','2026-11-02');
check(availabilityFor(state,base('future'),'2026-11-03').players.find(p=>p.playerId===sourceCase.playerId).eligible);
// A prepared proposal becomes stale if a later commissioner decision changes its eligibility.
const stalePrepared=prepareCompetitiveInput(state,base('late-proposal','late-proposal','comp-b',0),'2026-11-04');
const laterCase=operationsView(state).active.flatMap(r=>r.discipline).find(c=>!operationsView(state).decisions.some(d=>d.caseId===c.id));
if(laterCase){apply('later-ban',{type:'discipline',caseId:laterCase.id,matches:1,reason:'Commissioner assessed another recorded incident'});
 rejects(()=>accept('stale-proposal',simulateCompetitiveMatch(stalePrepared),'comp-b','2026-11-04'),/Eligibility changed/);}
// Full recovery is required; insufficient rosters stop safely without a score.
const unavailable=structuredClone(pristine);
for(const p of unavailable.availability.players.slice(0,21)){p.eligible=false;p.injuryIds=['test-absence'];}
rejects(()=>simulateCompetitiveMatch(unavailable),/Fewer than 15/);
const noReserves=structuredClone(pristine);noReserves.config.injuryChancePerContest=1;
for(const p of noReserves.availability.players.slice(0,20)){p.eligible=false;p.injuryIds=['test-absence'];}
rejects(()=>simulateCompetitiveMatch(noReserves),/Insufficient eligible players after injury/);
const malformed=structuredClone(pristine);malformed.availability.players[0].eligible=false;
rejects(()=>validateCompetitiveInput(malformed),/evidence/);
// Aborted attempts contain no partial ledger and create no availability/stat effects.
const beforeAttempt=operationsView(state),attempt={fixtureId:'aborted-fixture',inputSHA256:'a'.repeat(64),seed:'pinned-seed',engineVersion:original.engineVersion,outcome:'aborted',code:'safety_limit'};
apply('attempt-1',{type:'attempt',evidence:attempt});apply('attempt-2',{type:'attempt',evidence:attempt});
apply('lost-reply',{type:'attempt',evidence:{...attempt,outcome:'proposal_saved',code:'transport_failure'}});
equal(operationsView(state),beforeAttempt);
rejects(()=>apply('restart-accepted',{type:'attempt',evidence:{...attempt,fixtureId:original.id}}),/recover it/);
rejects(()=>apply('rerolled-attempt',{type:'attempt',evidence:{...attempt,seed:'different-seed'}}),/preserve pinned/);
rejects(()=>apply('partial-attempt',{type:'attempt',evidence:{...attempt,scores:[99,99]}}),/partial/);
rejects(()=>simulateCompetitiveMatch(prepareCompetitiveInput(state,{...base('guard','guard','comp-b',0),config:{maxEvents:100}},'2026-11-05')),/no result or forced winner/);
// Closure is an explicit gate; unresolved incidents and incomplete fixture lists block it.
rejects(()=>apply('premature-close',{type:'close',competitionId:'comp-a',reason:'All approved fixtures completed'}),/Resolve/);
for(const c of firstEvidence.discipline)if(!operationsView(state).decisions.some(d=>d.caseId===c.id))apply('dismiss-'+c.id,{type:'discipline',caseId:c.id,matches:0,reason:'Commissioner found no additional suspension warranted'});
apply('close-a',{type:'close',competitionId:'comp-a',reason:'All approved fixtures completed'},{competitionComplete:true});
rejects(()=>apply('closed-correction',{type:'correct',resultId:firstEvidence.id,kind:'technical',reason:'Correct an administrative eligibility input error'}),/reopening/);
apply('reopen-a',{type:'reopen',competitionId:'comp-a',reason:'Reopen to address the documented technical correction'});
rejects(()=>apply('referee-appeal',{type:'correct',resultId:firstEvidence.id,kind:'refereeing',reason:'Disagree with the referee decision in the original match'}),/final/);
const originalPayload=competitionJSON(state.events.find(e=>e.id===firstEvidence.id));
apply('void-original',{type:'correct',resultId:firstEvidence.id,kind:'administrative',reason:'Incorrect recorded eligibility requires a corrected simulation'});
const corrected=operationsView(state);
check(!corrected.active.some(r=>r.id===firstEvidence.id));
check(!corrected.injuries.some(i=>i.sourceResultId===firstEvidence.id));
check(!corrected.suspensions.some(s=>s.sourceResultId===firstEvidence.id));
check(corrected.reviews.some(r=>r.resultId==='accepted-next'&&!r.resolvedBy));
check(corrected.reviews.some(r=>r.resultId==='accepted-recovery'&&!r.resolvedBy));
equal(competitionJSON(state.events.find(e=>e.id===firstEvidence.id)),originalPayload);
check(corrected.active.length===2); // Later results stay recorded and flagged; no automatic replay/void.
check(operationsTeamRecords(state).reduce((s,r)=>s+r.played,0)===4);
check(operationsTeamRecords(state).reduce((s,r)=>s+r.pointsFor,0)===corrected.active.reduce((s,r)=>s+r.scores[0]+r.scores[1],0));
const wrongSeed=prepareCompetitiveInput(state,base('replacement-wrong','new-seed'),'2026-10-31',firstEvidence.id);
rejects(()=>accept('replacement-wrong',simulateCompetitiveMatch(wrongSeed),'comp-a','2026-10-31',firstEvidence.id),/original pinned seed/);
const replacementBase=base('replacement-correct',original.seed);replacementBase.teams[0].players[0].ratings.speed++;
const replacement=prepareCompetitiveInput(state,replacementBase,'2026-10-31',firstEvidence.id);
check(replacement.availability.players.every(p=>p.eligible)); // Future bans/services must not leak into the historical replacement.
accept('accepted-replacement',simulateCompetitiveMatch(replacement),'comp-a','2026-10-31',firstEvidence.id);
check(operationsView(state).active.some(r=>r.replaces===firstEvidence.id));
for(const review of operationsView(state).reviews.filter(r=>!r.resolvedBy))apply('uphold-'+review.id,{type:'resolve-review',reviewId:review.id,reason:'Commissioner reviewed the affected fixture and upheld its result'});
check(operationsView(state).reviews.every(r=>r.resolvedBy));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'century-availability-'));let crossRuntime;
try{
 const output=path.join(directory,'deno.json');
 const deno=spawnSync('npm',['exec','--yes','--package=deno@2.6.4','--','deno','run','--allow-read','--allow-write','scripts/availability-runtime-probe.mjs',output],{encoding:'utf8',timeout:60000});
 assert.equal(deno.status,0,deno.stderr);
 const other=JSON.parse(fs.readFileSync(output));
 crossRuntime=compareMatchReplay(candidateProbe.result,other.result,COORDINATE_REPLAY_POLICY);
 check(crossRuntime.equivalent);equal(candidateProbe.recoveryDurations,other.recoveryDurations);
}finally{fs.rmSync(directory,{recursive:true,force:true});}
console.log(JSON.stringify({checks,status:'passed',engine:adapted.engineVersion,healthyMatchIdenticalToFrozenBaseline:true,
 persistentEffects:'validated in domain journal; official integration remains gated',crossRuntime,liveDatabaseWrites:0}));
