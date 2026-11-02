import { RequestError, matchRPC } from './shared.ts';
import type { MatchDB } from './shared.ts';
import { competitionJSON } from './simulation/competition/index.ts';
import { compareMatchReplay, COORDINATE_REPLAY_POLICY } from './simulation/competition/replay.ts';
import { APPROVED_RECOVERY_POLICY, COMPETITIVE_SOURCE_SHA256, availabilityFor, prepareCompetitiveInput,
  simulateCompetitiveMatch, executeOperation, operationsView, operationsTeamRecords, calendarDate } from './simulation/competitive/index.ts';
import type { OperationsState, OperationCommand, CompetitiveMatchInput } from './simulation/competitive/index.ts';
import { matchBriefing } from './simulation/match/report.ts';
import type { MatchInput, MatchResult } from './simulation/match/types.ts';

function id(v: unknown): string {
  if (typeof v !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v)) throw new RequestError('Valid record ID required');
  return v;
}
function text(v: unknown): string { if (typeof v !== 'string' || !v.trim() || v.length > 1000) throw new RequestError('Recorded text required'); return v.trim(); }
function revision(v: unknown): number { if (!Number.isSafeInteger(v) || Number(v) < 0) throw new RequestError('Current rehearsal revision required'); return Number(v); }
type Fixture = { id: string; stream_id: string; season_id: string; round_id: string; match_date: string; match_input: MatchInput;
  source_fixture_id: string | null; replaces_result_id: string | null; proposal_id: string | null; result_sha256: string | null;
  accepted_event_id: string | null; pinned_input: CompetitiveMatchInput | null; input_sha256: string | null };
export type Saved = { id: string; name: string; competitionId?: string; status?: string; operations: { state: OperationsState; headSHA256: string }; fixtures: Fixture[] };
const actions = ['rehearsal-list','rehearsal-create','rehearsal-detail','rehearsal-simulate','rehearsal-proposal','rehearsal-verify','rehearsal-accept','rehearsal-command','rehearsal-replace','rehearsal-briefing'];
const read = (db: MatchDB, actor: {id:string}, stream: string): Promise<Saved> => matchRPC(db,'read_competitive_rehearsal_v1',{p_actor:actor.id,p_id:stream});
const source = (db: MatchDB, actor: {id:string}, stream: string, proposal: string): Promise<{id:string;sha256:string;result:MatchResult}> =>
  matchRPC(db,'read_operations_proposal_candidate_v1',{p_actor:actor.id,p_stream_id:stream,p_proposal_id:proposal});
const leaf = (saved: Saved, f: Fixture) => !saved.fixtures.some(child=>child.source_fixture_id===f.id);
function pendingFor(saved: Saved, f: Fixture) {
  const target=f.replaces_result_id?operationsView(saved.operations.state).results.find(r=>r.id===f.replaces_result_id):undefined;
  const view=operationsView(saved.operations.state,target?.sequence),players=new Set(f.match_input.teams.flatMap(t=>t.players.map(p=>p.id)));
  return {
    incidents:view.active.flatMap(r=>r.discipline).filter(c=>players.has(c.playerId)&&!view.decisions.some(d=>d.caseId===c.id)),
    reviews:view.reviews.filter(r=>!r.resolvedBy&&view.active.find(x=>x.id===r.resultId)?.playerIds.some(id=>players.has(id)))
  };
}
function requireReady(saved: Saved, f: Fixture) {
  if (!leaf(saved,f)) throw new RequestError('This fixture has been superseded; use its recorded replacement.',409);
  const view=operationsView(saved.operations.state);
  if(saved.status==='draft')throw new RequestError('Activate the competition before simulating or accepting.',409);
  if(view.closedCompetitionIds.includes(saved.competitionId??saved.id))throw new RequestError('Reopen this competition before changing results.',409);
  const pending=pendingFor(saved,f);
  if(pending.incidents.length||pending.reviews.length)throw new RequestError('Resolve the affected incident and match reviews before the next match.',409);
}
function fixtureDefinition(raw: any) {
  if(!raw||!Array.isArray(raw.teamIds)||raw.teamIds.length!==2)throw new RequestError('Two canonical teams required');
  calendarDate(raw.matchDate);
  return {id:id(raw.id),seasonId:id(raw.seasonId),roundId:text(raw.roundId),matchDate:raw.matchDate,teamIds:raw.teamIds.map(id)};
}
async function append(db: MatchDB, actor: {id:string;role:string}, saved: Saved, commandId: string, expected: number,
  operation: OperationCommand['operation'], context: {result?:MatchResult;competitionComplete?:boolean}={}) {
  const state=saved.operations.state,prior=state.events.find(e=>e.id===commandId);
  if(prior){
    if(prior.actor!==actor.id||competitionJSON(prior.operation)!==competitionJSON(operation))throw new RequestError('Conflicting saved request');
    return {id:prior.id,added:false,revision:state.revision};
  }
  if(expected!==state.revision)throw new RequestError('The rehearsal changed. Refresh before retrying.',409);
  let event;
  try { event=executeOperation(state,{id:commandId,expectedRevision:expected,at:new Date().toISOString(),operation},actor,context).event; }
  catch(error){throw new RequestError(error instanceof Error?error.message:'Invalid rehearsal operation',409);}
  return matchRPC(db,'append_operation_candidate_v1',{p_actor:actor.id,p_stream_id:saved.id,p_expected_revision:state.revision,p_expected_head:saved.operations.headSHA256,p_event:event});
}
function detail(saved: Saved) {
  const state=saved.operations.state,view=operationsView(state);
  const players=new Map(saved.fixtures.flatMap(f=>f.match_input.teams.flatMap(t=>t.players.map(p=>[p.id,p.name] as const))));
  const teams=new Map(saved.fixtures.flatMap(f=>f.match_input.teams.map(t=>[t.id,t.name] as const)));
  const records=operationsTeamRecords(state,saved.competitionId);
  return {id:saved.competitionId??saved.id,name:saved.name,classification:saved.competitionId?'competitive':'competitive-rehearsal',revision:state.revision,status:view.closedCompetitionIds.includes(saved.competitionId??saved.id)?'closed':saved.status??'active',
    policy:state.policy,records:[...teams].map(([teamId,name])=>({... (records.find(r=>r.teamId===teamId)??{teamId,played:0,wins:0,losses:0,pointsFor:0,pointsAgainst:0}),name})),
    fixtures:saved.fixtures.map(f=>{
      const accepted=view.results.find(r=>r.fixtureId===f.id),current=availabilityFor(state,f.match_input,f.match_date,f.replaces_result_id??undefined);
      const availability=accepted&&f.pinned_input?f.pinned_input.availability:current;
      const changed=!accepted&&f.pinned_input&&competitionJSON(f.pinned_input.availability)!==competitionJSON(current),pending=pendingFor(saved,f);
      return {id:f.id,seasonId:f.season_id,roundId:f.round_id,matchDate:f.match_date,teams:f.match_input.teams.map(t=>({id:t.id,name:t.name})),
        proposalId:f.proposal_id,acceptedId:accepted?.id??null,scores:accepted?.scores??null,sourceFixtureId:f.source_fixture_id,
        status:!leaf(saved,f)?'superseded':accepted?.voidedBy?'voided':accepted?'accepted':f.proposal_id?'proposed':f.pinned_input?'pinned':'scheduled',
        eligibilityChanged:Boolean(changed),blocked:!accepted&&Boolean(pending.incidents.length||pending.reviews.length),
        availability:availability.players.map(p=>({...p,name:players.get(p.playerId)})),eligibleCounts:f.match_input.teams.map(t=>t.players.filter(p=>availability.players.find(x=>x.playerId===p.id)?.eligible).length)};
    }),
    injuries:view.injuries.map(i=>({...i,name:players.get(i.playerId)})),
    suspensions:view.suspensions.filter(s=>s.servedBy.length<s.matches).map(s=>({...s,name:players.get(s.playerId),remaining:s.matches-s.servedBy.length})),
    incidents:view.active.flatMap(r=>r.discipline).filter(c=>!view.decisions.some(d=>d.caseId===c.id)).map(c=>({...c,name:players.get(c.playerId)})),
    reviews:view.reviews.filter(r=>!r.resolvedBy),audit:state.events.map(e=>({id:e.id,at:e.at,actor:e.actor,operation:e.operation})),
    evidencePolicy:saved.competitionId?'Official competitive results. Injury recovery and bans follow player IDs across competitions and monthly seasons.':'Rehearsal results only. Fatigue resets; injury recovery and bans persist within this rehearsal. No official league records are changed.'};
}
export type Workflow = {
  read:(db:MatchDB,actor:{id:string},id:string)=>Promise<Saved>;
  pinRPC:string; replaceRPC:string;
};
const rehearsalWorkflow: Workflow={read,pinRPC:'pin_rehearsal_input_v1',replaceRPC:'replace_rehearsal_fixture_v1'};
export async function handleRehearsalAction(db: MatchDB, actor: {id:string;role:string}, body: any): Promise<any> {
  if(actor.role!=='commissioner')throw new RequestError('Commissioner access required',403);
  if(!actions.includes(body.action))throw new RequestError('Unknown rehearsal action');
  if(body.action==='rehearsal-list')return matchRPC(db,'list_competitive_rehearsals_v1',{p_actor:actor.id});
  if(body.action==='rehearsal-create'){
    if(!Array.isArray(body.fixtures)||!body.fixtures.length||body.fixtures.length>32)throw new RequestError('Supply explicit rehearsal fixtures');
    return matchRPC(db,'create_competitive_rehearsal_v1',{p_actor:actor.id,p_id:id(body.rehearsalId),p_name:text(body.name),p_fixtures:body.fixtures.map(fixtureDefinition),p_policy:APPROVED_RECOVERY_POLICY,p_source_sha:COMPETITIVE_SOURCE_SHA256});
  }
  return handleCompetitiveWorkflow(db,actor,body,rehearsalWorkflow);
}
/** Shared proposal/replay/acceptance mechanics; each adapter supplies its canonical store. */
export async function handleCompetitiveWorkflow(db: MatchDB, actor: {id:string;role:string}, body:any, workflow:Workflow):Promise<any>{
  if(actor.role!=='commissioner')throw new RequestError('Commissioner access required',403);
  const saved=await workflow.read(db,actor,id(body.rehearsalId)),stream=saved.id,competition=saved.competitionId??stream,state=saved.operations.state,view=operationsView(state);
  if(body.action==='rehearsal-detail')return detail(saved);
  if(body.action==='rehearsal-replace'){
    const f=saved.fixtures.find(f=>f.id===id(body.fixtureId));if(!f)throw new RequestError('Unknown source fixture');
    const raw=fixtureDefinition({id:body.newFixtureId,seasonId:body.seasonId??f.season_id,roundId:f.round_id,matchDate:f.match_date,teamIds:body.teamIds??f.match_input.teams.map(t=>t.id)});
    return matchRPC(db,workflow.replaceRPC,{p_actor:actor.id,p_stream:stream,p_source:f.id,p_fixture:raw,p_expected_revision:revision(body.expectedRevision),p_reason:text(body.reason),p_source_sha:COMPETITIVE_SOURCE_SHA256});
  }
  if(body.action==='rehearsal-command'){
    const raw=body.operation??{};let operation: OperationCommand['operation'];
    if(raw.type==='discipline')operation={type:'discipline',caseId:text(raw.caseId),matches:raw.matches,reason:text(raw.reason)};
    else if(raw.type==='correct')operation={type:'correct',resultId:id(raw.resultId),kind:raw.kind,reason:text(raw.reason)};
    else if(raw.type==='resolve-review')operation={type:'resolve-review',reviewId:text(raw.reviewId),reason:text(raw.reason)};
    else if(raw.type==='close'||raw.type==='reopen')operation={type:raw.type,competitionId:competition,reason:text(raw.reason)};
    else throw new RequestError('Unsupported commissioner operation');
    const complete=saved.fixtures.filter(f=>leaf(saved,f)).every(f=>view.active.some(r=>r.fixtureId===f.id));
    return append(db,actor,saved,id(body.commandId),revision(body.expectedRevision),operation,{competitionComplete:complete});
  }
  if(body.action==='rehearsal-briefing'){
    const round=text(body.roundId),fixtures=saved.fixtures.filter(f=>leaf(saved,f)&&f.round_id===round),matches=[],playerTotals=new Map<string,any>();
    for(const f of fixtures){
      const accepted=view.active.find(r=>r.fixtureId===f.id);if(!accepted)continue;
      const p=await source(db,actor,stream,accepted.proposalId);
      matches.push({...matchBriefing(p.result),requiresReview:view.reviews.some(r=>r.resultId===accepted.id&&!r.resolvedBy)});
      for(const player of p.result.players){
        const total=playerTotals.get(player.id)??{id:player.id,name:player.name,secondsPlayed:0,stats:{}};
        total.secondsPlayed+=player.secondsPlayed;
        for(const [key,n] of Object.entries(player.stats))total.stats[key]=(total.stats[key]??0)+n;
        playerTotals.set(player.id,total);
      }
    }
    return {classification:saved.competitionId?'competitive':'competitive-rehearsal',competitionId:competition,...(!saved.competitionId?{rehearsalId:stream}:{}),roundId:round,acceptedMatches:matches.length,pendingFixtures:fixtures.length-matches.length,matches,playerTotals:[...playerTotals.values()],evidencePolicy:saved.competitionId?'Active accepted official facts only; voided/superseded results omitted. Review flags remain explicit. Availability persists across monthly seasons.':'Active accepted rehearsal facts only; voided/superseded results omitted. Review flags remain explicit. Injuries and bans persist within this rehearsal; official league records are unchanged.'};
  }
  if(body.action==='rehearsal-simulate'){
    const f=saved.fixtures.find(f=>f.id===id(body.fixtureId));if(!f)throw new RequestError('Unknown rehearsal fixture');
    if(f.proposal_id)return {id:f.proposal_id,added:false}; // Recover first, including after a lost successful reply.
    requireReady(saved,f);
    if(f.match_input.provenance?.engineSourceSHA256!==COMPETITIVE_SOURCE_SHA256)throw new RequestError('This pinned engine source requires its original adapter.',409);
    let pinned=f.pinned_input,sha=f.input_sha256;
    if(!pinned){
      let input;try{input=prepareCompetitiveInput(state,f.match_input,f.match_date,f.replaces_result_id??undefined);}catch(e){throw new RequestError(e instanceof Error?e.message:'Unavailable roster',409);}
      const pin=await matchRPC(db,workflow.pinRPC,{p_actor:actor.id,p_stream:stream,p_fixture:f.id,p_revision:state.revision,p_head:saved.operations.headSHA256,p_input:input});
      pinned=pin.input;sha=pin.sha256;
    }
    if(competitionJSON(pinned!.availability)!==competitionJSON(availabilityFor(state,f.match_input,f.match_date,f.replaces_result_id??undefined)))throw new RequestError('Eligibility changed. Preserve this attempt and prepare a replacement fixture.',409);
    let result;
    try{result=simulateCompetitiveMatch(pinned!);}catch(e){
      const fresh=await workflow.read(db,actor,saved.competitionId??stream);
      await append(db,actor,fresh,crypto.randomUUID(),fresh.operations.state.revision,{type:'attempt',evidence:{fixtureId:f.id,inputSHA256:sha!,seed:pinned!.seed,engineVersion:'0.2.0-availability-candidate',outcome:'aborted',code:'safety_limit'}});
      throw new RequestError(e instanceof Error?e.message:'Simulation aborted; pinned input is preserved.',409);
    }
    return matchRPC(db,'stage_operations_proposal_candidate_v1',{p_actor:actor.id,p_stream_id:stream,p_proposal_id:crypto.randomUUID(),p_result:result});
  }
  const proposalId=id(body.proposalId),p=await source(db,actor,stream,proposalId);
  const f=saved.fixtures.find(f=>f.proposal_id===p.id);if(!f)throw new RequestError('Proposal has no rehearsal fixture');
  if(body.action==='rehearsal-accept'){
    const prior=view.results.find(r=>r.proposalId===p.id);
    if(prior)return {id:prior.id,added:false,revision:state.revision,voided:Boolean(prior.voidedBy)};
    requireReady(saved,f);
    return append(db,actor,saved,id(body.commandId),revision(body.expectedRevision),{type:'accept',proposalId:p.id,resultSHA256:p.sha256,competitionId:competition,matchDate:f.match_date,...(f.replaces_result_id?{replaces:f.replaces_result_id}:{})},{result:p.result});
  }
  if(body.action==='rehearsal-verify'){
    const replay=compareMatchReplay(p.result,simulateCompetitiveMatch(p.result.input as CompetitiveMatchInput),COORDINATE_REPLAY_POLICY);
    if(!replay.equivalent)throw new RequestError(`Replay mismatch at ${replay.firstMismatch}`);
    return {id:p.id,sha256:p.sha256,replay};
  }
  return {id:p.id,fixtureId:f.id,sha256:p.sha256,result:p.result,briefing:matchBriefing(p.result)};
}
