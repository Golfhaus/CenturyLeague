import { competitionJSON } from '../competition/index.js';
import { compareMatchReplay, COORDINATE_REPLAY_POLICY } from '../competition/replay.js';
import type { MatchResult, MatchInput } from '../match/types.js';
import { simulateCompetitiveMatch } from './engine.js';
import { pinAvailability, recoveryDays, addCalendarDays, calendarDate, validateRecoveryPolicy,
  validateCompetitiveInput, COMPETITIVE_ENGINE_VERSION } from './availability.js';
import type { RecoveryPolicy, InjuryAbsence, Suspension, CompetitiveMatchInput, AvailabilitySnapshot } from './availability.js';

export interface DisciplineCase { id: string; playerId: string; eventIds: number[]; reason: 'serious_foul_review' | 'repeated_fouls_review' }
export interface AcceptedEvidence {
  id: string; fixtureId: string; competitionId: string; proposalId: string; resultSHA256: string; matchDate: string;
  sequence: number; teamIds: [string,string]; playerIds: string[]; scores: [number,number]; winner: number;
  availability: AvailabilitySnapshot; injuries: InjuryAbsence[]; discipline: DisciplineCase[];
  suspensionService: string[]; voidedBy: string | null; replaces: string | null; seed: string;
}
interface Decision { id: string; caseId: string; sourceResultId: string; playerId: string; matches: number; sequence: number; reason: string }
interface Review { id: string; resultId: string; correctionId: string; resolvedBy: string | null }
export interface AttemptEvidence {
  fixtureId: string; inputSHA256: string; seed: string; engineVersion: string;
  outcome: 'aborted' | 'proposal_saved' | 'accepted'; code: 'safety_limit' | 'transport_failure' | 'completed';
}
export interface OperationCommand {
  id: string; expectedRevision: number; at: string;
  operation:
    | { type: 'accept'; proposalId: string; resultSHA256: string; competitionId: string; matchDate: string; replaces?: string }
    | { type: 'discipline'; caseId: string; matches: number; reason: string }
    | { type: 'correct'; resultId: string; kind: 'technical' | 'administrative'; reason: string }
    | { type: 'resolve-review'; reviewId: string; reason: string }
    | { type: 'close' | 'reopen'; competitionId: string; reason: string }
    | { type: 'attempt'; evidence: AttemptEvidence };
}
export interface OperationEvent {
  id: string; revision: number; actor: string; at: string; request: string;
  operation: OperationCommand['operation']; accepted?: AcceptedEvidence;
}
export interface OperationsState {
  schemaVersion: 'century-operations-v1-candidate'; category: 'men' | 'women'; policy: RecoveryPolicy;
  revision: number; events: OperationEvent[];
}
export function createOperations(category: 'men' | 'women', policy: RecoveryPolicy): OperationsState {
  if (!['men','women'].includes(category)) throw new Error('Invalid operations category');
  validateRecoveryPolicy(policy);
  return {schemaVersion:'century-operations-v1-candidate',category,policy:structuredClone(policy),revision:0,events:[]};
}
function text(value: string): void { if (typeof value!=='string'||!value.trim()||value.length>1000) throw new Error('Recorded text required'); }
function reason(value: string): void { text(value); if(value.trim().length<10) throw new Error('Specific reason required (at least 10 characters)'); }
function digest(value: string): void { if(!/^[a-f0-9]{64}$/.test(value))throw new Error('Saved payload SHA256 required'); }
function validateState(state: OperationsState): void {
  if(state.schemaVersion!=='century-operations-v1-candidate'||!['men','women'].includes(state.category)||
      state.revision!==state.events.length||new Set(state.events.map(e=>e.id)).size!==state.events.length||
      state.events.some((e,i)=>e.revision!==i+1))throw new Error('Invalid operations journal');
  validateRecoveryPolicy(state.policy);
}
export function operationsView(state: OperationsState, beforeSequence = Infinity) {
  validateState(state);
  const results: AcceptedEvidence[]=[], decisions: Decision[]=[], reviews: Review[]=[], closed=new Set<string>();
  for(const e of state.events) {
    const op=e.operation;
    if(op.type==='accept') {
      if(!e.accepted)throw new Error('Missing accepted-result evidence');
      if(e.accepted.replaces){
        const original=results.find(r=>r.id===e.accepted!.replaces);
        if(!original)throw new Error('Missing replacement source');
        const correctionId=original.voidedBy??e.id;
        for(const r of results)if(!r.voidedBy&&r.sequence>original.sequence&&r.matchDate>=original.matchDate&&
            r.playerIds.some(id=>e.accepted!.playerIds.includes(id))&&!reviews.some(v=>v.resultId===r.id&&v.correctionId===correctionId))
          reviews.push({id:`${e.id}:${r.id}`,resultId:r.id,correctionId,resolvedBy:null});
      }
      results.push(structuredClone(e.accepted));
    } else if(op.type==='discipline') {
      const source=results.find(r=>r.discipline.some(c=>c.id===op.caseId));
      if(!source)throw new Error('Discipline source missing');
      const c=source.discipline.find(c=>c.id===op.caseId)!;
      decisions.push({id:e.id,caseId:c.id,sourceResultId:source.id,playerId:c.playerId,matches:op.matches,sequence:e.revision,reason:op.reason});
    } else if(op.type==='correct') {
      const source=results.find(r=>r.id===op.resultId);
      if(!source)throw new Error('Correction source missing');
      source.voidedBy=e.id;
      for(const r of results)if(!r.voidedBy&&r.sequence>source.sequence&&r.matchDate>=source.matchDate&&r.playerIds.some(id=>source.playerIds.includes(id)))
        reviews.push({id:`${e.id}:${r.id}`,resultId:r.id,correctionId:e.id,resolvedBy:null});
      for(const r of reviews)if(r.resultId===source.id&&!r.resolvedBy)r.resolvedBy=e.id;
    } else if(op.type==='resolve-review') {
      const review=reviews.find(r=>r.id===op.reviewId);if(!review)throw new Error('Review source missing');review.resolvedBy=e.id;
    } else if(op.type==='close')closed.add(op.competitionId);
    else if(op.type==='reopen')closed.delete(op.competitionId);
  }
  const active=results.filter(r=>!r.voidedBy&&r.sequence<beforeSequence), activeIds=new Set(active.map(r=>r.id));
  const injuries=active.flatMap(r=>r.injuries);
  const suspensions: Suspension[]=decisions.filter(d=>d.sequence<beforeSequence&&d.matches>0&&activeIds.has(d.sourceResultId)).map(d=>({
    id:d.id,playerId:d.playerId,sourceResultId:d.sourceResultId,matches:d.matches,
    servedBy:active.filter(r=>r.sequence>d.sequence&&r.suspensionService.includes(d.id)).map(r=>r.id)
  }));
  return {results,active,injuries,suspensions,decisions,reviews,closedCompetitionIds:[...closed]};
}
export function availabilityFor(state: OperationsState, input: MatchInput, matchDate: string, replacesResultId?: string): AvailabilitySnapshot {
  const target=replacesResultId?operationsView(state).results.find(r=>r.id===replacesResultId):undefined;
  if(replacesResultId&&!target)throw new Error('Unknown replacement source');
  const view=operationsView(state,target?.sequence);
  const pinned=pinAvailability(input,state.category,matchDate,view.injuries,view.suspensions);
  if(replacesResultId)pinned.replacesResultId=replacesResultId;
  return pinned;
}
export function operationsTeamRecords(state: OperationsState, competitionId?: string) {
  const view=operationsView(state);
  const scoped=(r: AcceptedEvidence)=>!competitionId||r.competitionId===competitionId;
  const rows=[...new Set(view.results.filter(scoped).flatMap(r=>r.teamIds))].map(teamId=>({teamId,played:0,wins:0,losses:0,pointsFor:0,pointsAgainst:0}));
  for(const result of view.active.filter(scoped))for(const side of [0,1]){
    const row=rows.find(r=>r.teamId===result.teamIds[side])!;
    row.played++;if(side===result.winner)row.wins++;else row.losses++;
    row.pointsFor+=result.scores[side];row.pointsAgainst+=result.scores[1-side];
  }
  return rows;
}
export function prepareCompetitiveInput(state: OperationsState, input: MatchInput, matchDate: string, replacesResultId?: string): CompetitiveMatchInput {
  const pinned={...structuredClone(input),availability:availabilityFor(state,input,matchDate,replacesResultId)};
  validateCompetitiveInput(pinned);return pinned;
}
/** Backend-only domain service: result context must be loaded from an immutable
 * saved proposal, never deserialized from a browser's operation request. The
 * storage adapter must commit this event and result acceptance in one transaction. */
export function executeOperation(state: OperationsState, command: OperationCommand, actor: {id:string;role:string},
  context: {result?: MatchResult; competitionComplete?: boolean}={}): {state: OperationsState; event: OperationEvent; added: boolean} {
  validateState(state);
  if(actor.role!=='commissioner')throw new Error('Commissioner authority required');
  text(actor.id);text(command.id);
  if(!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<0||!Number.isFinite(Date.parse(command.at)))throw new Error('Revision and timestamp required');
  const request=competitionJSON({operation:command.operation,at:command.at});
  const prior=state.events.find(e=>e.id===command.id);
  if(prior){if(prior.request!==request||prior.actor!==actor.id)throw new Error('Conflicting operation retry');return {state,event:prior,added:false};}
  if(command.expectedRevision!==state.revision)throw new Error('Stale operations revision');
  const view=operationsView(state),op=command.operation;
  const event: OperationEvent={id:command.id,revision:state.revision+1,actor:actor.id,at:new Date(command.at).toISOString(),request,operation:structuredClone(op)};
  if(op.type==='accept') {
    text(op.proposalId);text(op.competitionId);digest(op.resultSHA256);calendarDate(op.matchDate);
    if(view.closedCompetitionIds.includes(op.competitionId))throw new Error('Explicit reopening required');
    if(view.results.some(r=>r.proposalId===op.proposalId))throw new Error('Proposal already registered; recover its operation');
    const result=context.result;
    if(!result||result.engineVersion!==COMPETITIVE_ENGINE_VERSION)throw new Error('Versioned competitive result required');
    const input=result.input as CompetitiveMatchInput;
    validateCompetitiveInput(input);
    if(input.availability.matchDate!==op.matchDate||input.availability.category!==state.category||
        input.provenance?.classification!=='competitive'||input.provenance?.competitionId!==op.competitionId||
        input.provenance?.competitionCategory!==state.category)throw new Error('Result competition/date/category scope differs');
    const expected=availabilityFor(state,input,op.matchDate,op.replaces);
    if(competitionJSON(expected)!==competitionJSON(input.availability))throw new Error('Eligibility changed; preserve proposal and explicitly repin before replay');
    if(!compareMatchReplay(result,simulateCompetitiveMatch(input),COORDINATE_REPLAY_POLICY).equivalent)throw new Error('Competitive result fails full replay');
    if(view.results.some(r=>r.fixtureId===result.id))throw new Error('Fixture already has a historical result; use a distinct replacement fixture');
    const playerIds=input.teams.flatMap(t=>t.players.map(p=>p.id));
    let replaced: AcceptedEvidence | undefined;
    if(op.replaces){
      replaced=view.results.find(r=>r.id===op.replaces);
      if(!replaced?.voidedBy||replaced.competitionId!==op.competitionId||replaced.matchDate!==op.matchDate||
          view.results.some(r=>r.replaces===op.replaces&&!r.voidedBy))throw new Error('Explicit voided source/date/scope required for replacement');
      // Keep the original random seed; corrected inputs/engine identify the new simulation.
      if(input.seed!==replaced.seed)throw new Error('Replacement must retain the original pinned seed');
    } else if(view.active.some(r=>r.matchDate>op.matchDate&&r.playerIds.some(id=>playerIds.includes(id))))throw new Error('Out-of-order player match requires commissioner correction');
    const injuries: InjuryAbsence[]=result.events.filter(e=>e.type==='injury').map(e=>{
      if(!e.playerId||!playerIds.includes(e.playerId))throw new Error('Invalid injury source');
      return {id:`${command.id}:injury:${e.id}`,playerId:e.playerId,sourceResultId:command.id,startsOn:op.matchDate,
        recoveredOn:addCalendarDays(op.matchDate,recoveryDays(state.policy,input.seed,e.id,e.playerId))};
    });
    const discipline: DisciplineCase[]=playerIds.flatMap(playerId=>{
      const fouls=result.events.filter(e=>e.type==='foul'&&e.playerId===playerId);
      if(!fouls.some(e=>e.data?.serious===true)&&fouls.length<3)return [];
      return [{id:`${command.id}:discipline:${playerId}`,playerId,eventIds:fouls.map(e=>e.id),
        reason:fouls.some(e=>e.data?.serious===true)?'serious_foul_review' as const:'repeated_fouls_review' as const}];
    });
    const suspensionService: string[]=[];
    const serviceView=replaced?operationsView(state,replaced.sequence):view;
    // Consecutive service: at most the oldest outstanding ban per healthy,
    // rostered player is reduced by this accepted official match.
    for(const p of input.availability.players)if(!p.injuryIds.length){
      const ban=serviceView.suspensions.find(s=>p.suspensionIds.includes(s.id)&&s.servedBy.length<s.matches);
      if(ban)suspensionService.push(ban.id);
    }
    event.accepted={id:command.id,fixtureId:result.id,competitionId:op.competitionId,proposalId:op.proposalId,resultSHA256:op.resultSHA256,
      matchDate:op.matchDate,sequence:event.revision,teamIds:input.teams.map(t=>t.id) as [string,string],playerIds,
      scores:[...result.scores],winner:result.winner,availability:structuredClone(input.availability),injuries,discipline,
      suspensionService,voidedBy:null,replaces:op.replaces??null,seed:input.seed};
  } else if(op.type==='discipline') {
    reason(op.reason);
    const source=view.active.find(r=>r.discipline.some(c=>c.id===op.caseId));
    if(!source||view.decisions.some(d=>d.caseId===op.caseId))throw new Error('Undecided active incident required');
    if(!Number.isSafeInteger(op.matches)||op.matches<0||op.matches>20)throw new Error('Explicit suspension of 0–20 matches required');
    if(view.closedCompetitionIds.includes(source.competitionId))throw new Error('Explicit reopening required');
  } else if(op.type==='correct') {
    reason(op.reason);
    if(!['technical','administrative'].includes(op.kind))throw new Error('Refereeing judgments are final');
    const source=view.active.find(r=>r.id===op.resultId);
    if(!source)throw new Error('Active accepted source required');
    if(view.closedCompetitionIds.includes(source.competitionId))throw new Error('Explicit reopening required');
  } else if(op.type==='resolve-review') {
    reason(op.reason);
    const review=view.reviews.find(r=>r.id===op.reviewId&&!r.resolvedBy);
    if(!review)throw new Error('Open affected-match review required');
    const source=view.results.find(r=>r.id===review.resultId)!;
    if(view.closedCompetitionIds.includes(source.competitionId))throw new Error('Explicit reopening required');
  } else if(op.type==='close'||op.type==='reopen') {
    text(op.competitionId);reason(op.reason);
    if(op.type==='reopen'&&!view.closedCompetitionIds.includes(op.competitionId))throw new Error('Competition is not closed');
    if(op.type==='close'&&(context.competitionComplete!==true||view.closedCompetitionIds.includes(op.competitionId)||!view.active.some(r=>r.competitionId===op.competitionId)||
        view.reviews.some(r=>!r.resolvedBy&&view.results.find(x=>x.id===r.resultId)?.competitionId===op.competitionId)||
        view.active.some(r=>r.competitionId===op.competitionId&&r.discipline.some(c=>!view.decisions.some(d=>d.caseId===c.id)))))throw new Error('Resolve incidents/reviews before closure');
  } else if(op.type==='attempt') {
    const a=op.evidence;text(a.fixtureId);text(a.seed);text(a.engineVersion);digest(a.inputSHA256);
    if(!['aborted','proposal_saved','accepted'].includes(a.outcome)||!['safety_limit','transport_failure','completed'].includes(a.code)||
        (a.outcome==='aborted'&&a.code==='completed')||(a.outcome!=='aborted'&&a.code==='safety_limit'))throw new Error('Invalid technical attempt evidence');
    if(Object.keys(a).sort().join(',')!=='code,engineVersion,fixtureId,inputSHA256,outcome,seed')throw new Error('Attempt history cannot include partial scores/results');
    if(a.outcome==='aborted'&&view.results.some(r=>r.fixtureId===a.fixtureId))throw new Error('Saved accepted result exists; recover it instead of restarting');
    const previous=state.events.filter(e=>e.operation.type==='attempt'&&e.operation.evidence.fixtureId===a.fixtureId).at(-1);
    if(previous?.operation.type==='attempt'&&(previous.operation.evidence.seed!==a.seed||previous.operation.evidence.inputSHA256!==a.inputSHA256||
        previous.operation.evidence.engineVersion!==a.engineVersion))throw new Error('Restart must preserve pinned inputs/seed/engine; use audited correction for changes');
  } else throw new Error('Unknown operations command');
  return {state:{...state,revision:event.revision,events:[...state.events,event]},event,added:true};
}
