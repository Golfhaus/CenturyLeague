import { createCompetition, validateCompetitionFixtureResult, verifyMatchReplay, COORDINATE_REPLAY_POLICY, COMPETITION_ENGINE_SOURCE_SHA256 } from './simulation/competition/index.ts';
import { simulateMatch, MATCH_ENGINE_VERSION } from './simulation/match/engine.ts';
import { matchBriefing } from './simulation/match/report.ts';
import type { CompetitionDefinition } from './simulation/competition/types.ts';
import type { MatchInput, MatchResult, MatchTeam } from './simulation/match/types.ts';
import { RequestError } from './shared.ts';
import { handleRehearsalAction } from './rehearsal-service.ts';
import { handleOfficialAction } from './official-service.ts';
export { RequestError } from './shared.ts';
// The interface is intentionally structural: the same service runs with a fake adapter in request tests.
type DB = { from:(name:string)=>any; rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:any;error:any}> };
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
function id(value:unknown):string{if(!uuid(value))throw new RequestError('Valid record ID required');return value as string;}
function revision(value:unknown):number{if(!Number.isSafeInteger(value)||Number(value)<0)throw new RequestError('Current competition revision required');return Number(value);}
async function value(p:PromiseLike<{data:any;error:any}>){const {data,error}=await p;if(error)throw new RequestError(error.code==='40001'?'The competition changed. Refresh before accepting another result.':error.message,error.code==='40001'?409:400);return data;}
export async function handleMatchAction(db:DB,actor:{id:string;role:string},body:any):Promise<any>{
 if(!body||typeof body!=='object'||Array.isArray(body))throw new RequestError('Action required');
 if(typeof body.action==='string'&&body.action.startsWith('rehearsal-'))return handleRehearsalAction(db,actor,body);
 if(typeof body.action==='string'&&body.action.startsWith('official-'))return handleOfficialAction(db,actor,body);
 const read=['list','detail','proposal','briefing','verify'];
 const write=['create-exhibition','activate','simulate','accept'];
 if(![...read,...write].includes(body.action))throw new RequestError('Unknown match action');
 if(write.includes(body.action)&&actor.role!=='commissioner')throw new RequestError('Commissioner access required',403);
 if(body.action==='list')return value(db.from('competitions').select('id,name,season_id,competition_category,classification,status,revision,created_at').eq('classification','exhibition').order('created_at',{ascending:false}).limit(200));
 if(body.action==='detail'){
  const competitionId=id(body.competitionId);
  const [competition,fixtures,records]=await Promise.all([
   value(db.from('competitions').select('id,name,season_id,competition_category,classification,status,revision').eq('id',competitionId).single()),
   value(db.from('competition_fixture_status').select('*').eq('competition_id',competitionId).order('ordinal')),
   value(db.from('competition_team_records').select('*').eq('competition_id',competitionId).order('name'))]);
  if(competition.classification!=='exhibition')throw new RequestError('Use the official competition workflow for these records',409);
  return {competition,fixtures,records};
 }
 if(body.action==='create-exhibition'){
  if(typeof body.name!=='string'||!body.name.trim()||body.name.length>160||!Array.isArray(body.fixtures)||body.fixtures.length<1||body.fixtures.length>500)throw new RequestError('Name and explicit exhibition fixtures required');
  const seasonId=id(body.seasonId),competitionId=id(body.competitionId);
  const season=await value(db.from('seasons').select('competition_category,starts_on,status').eq('id',seasonId).single());
  const snapshots=await value(db.from('team_season_rosters').select('team_id,match_team').eq('season_id',seasonId));
  const fixtures=body.fixtures.map((f:any)=>({id:id(f.id),roundId:f.roundId,teamIds:f.teamIds,seed:`${competitionId}:${id(f.id)}`}));
  const used=new Set<string>(fixtures.flatMap((f:any)=>f.teamIds));
  const teams:MatchTeam[]=snapshots.filter((s:any)=>used.has(s.team_id)).map((s:any)=>s.match_team);
  const definition:CompetitionDefinition={id:competitionId,name:body.name.trim(),seasonKey:season.starts_on.slice(0,7),category:season.competition_category,classification:'exhibition',engineVersion:MATCH_ENGINE_VERSION,engineSourceSHA256:COMPETITION_ENGINE_SOURCE_SHA256,teams,fixtures};
  try{createCompetition(definition);}catch(e){throw new RequestError(e instanceof Error?e.message:'Invalid fixtures');}
  return value(db.rpc('create_exhibition_competition_v1',{p_actor:actor.id,p_season_id:seasonId,p_definition:definition}));
 }
 if(body.action==='activate')return value(db.rpc('activate_competition_v1',{p_actor:actor.id,p_competition_id:id(body.competitionId),p_expected_revision:revision(body.expectedRevision)}));
 if(body.action==='accept')return value(db.rpc('accept_match_proposal_v1',{p_actor:actor.id,p_proposal_id:id(body.proposalId),p_expected_revision:revision(body.expectedRevision)}));
 if(body.action==='simulate'){
  const fixtureId=id(body.fixtureId);
  const prior=await value(db.from('match_proposals').select('id,result_sha256').eq('fixture_id',fixtureId).maybeSingle());
  if(prior)return {id:prior.id,added:false,sha256:prior.result_sha256};
  const fixture=await value(db.from('competition_fixtures').select('competition_id,match_input').eq('id',fixtureId).single());
  const competition=await value(db.from('competitions').select('status,definition').eq('id',fixture.competition_id).single());
  if(competition.definition.classification!=='exhibition')throw new RequestError('Use the official competition workflow',409);
  if(competition.status!=='active')throw new RequestError('Activate the exhibition before simulating');
  const result=simulateMatch(fixture.match_input as MatchInput);
  // Generated here from immutable DB inputs, never received from the caller. Full replay is available separately.
  validateCompetitionFixtureResult(competition.definition,result,false);
  return value(db.rpc('stage_match_proposal_v1',{p_actor:actor.id,p_fixture_id:fixtureId,p_result:result}));
 }
 if(body.action==='briefing'){
  const competitionId=id(body.competitionId);
  const c=await value(db.from('competitions').select('classification').eq('id',competitionId).single());
  if(c.classification!=='exhibition')throw new RequestError('Use the official competition briefing',409);
  if(typeof body.roundId!=='string'||!body.roundId.trim())throw new RequestError('Select a round');
  const fixtures=await value(db.from('competition_fixture_status').select('id,proposal_id,accepted_at').eq('competition_id',competitionId).eq('round_id',body.roundId).order('ordinal'));
  const accepted=fixtures.filter((f:any)=>f.accepted_at);
  // Fetch one ledger at a time, keeping round exports within Edge memory limits.
  const matches=[];
  for(const f of accepted){const p=await value(db.from('match_proposals').select('result').eq('id',f.proposal_id).single());matches.push(matchBriefing(p.result));}
  return {competitionId,roundId:body.roundId,acceptedMatches:accepted.length,pendingFixtures:fixtures.length-accepted.length,matches,evidencePolicy:'Accepted match facts only; pending fixtures are omitted. Fatigue and injuries reset after each exhibition.'};
 }
 const p=await value(db.from('match_proposals').select('*').eq('id',id(body.proposalId)).single());
 if(body.action==='verify'){
  const f=await value(db.from('competition_fixtures').select('competition_id').eq('id',p.fixture_id).single());
  const c=await value(db.from('competitions').select('definition').eq('id',f.competition_id).single());
  validateCompetitionFixtureResult(c.definition,p.result as MatchResult,false);
  const replay=verifyMatchReplay(p.result as MatchResult,COORDINATE_REPLAY_POLICY);
  if(!replay.equivalent)throw new RequestError(`Replay mismatch at ${replay.firstMismatch}`);
  return {id:p.id,verified:true,sha256:p.result_sha256,replay};
 }
 return {id:p.id,fixtureId:p.fixture_id,sha256:p.result_sha256,result:p.result,briefing:matchBriefing(p.result)};
}
