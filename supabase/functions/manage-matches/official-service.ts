import {RequestError,matchRPC} from './shared.ts';
import type {MatchDB} from './shared.ts';
import {handleCompetitiveWorkflow} from './rehearsal-service.ts';
import type {Workflow} from './rehearsal-service.ts';

const uuid=(v:unknown):string=>{if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v))throw new RequestError('Valid record ID required');return v;};
const workflow:Workflow={
 read:(db,actor,id)=>matchRPC(db,'read_official_competition_v1',{p_actor:actor.id,p_id:id}),
 pinRPC:'pin_official_input_v1',replaceRPC:'replace_official_fixture_v1'
};
const delegated=['detail','simulate','proposal','verify','accept','command','replace','briefing'];
export async function handleOfficialAction(db:MatchDB,actor:{id:string;role:string},body:any):Promise<any>{
 if(actor.role!=='commissioner')throw new RequestError('Commissioner access required',403);
 if(body.action==='official-readiness')return matchRPC(db,'official_readiness_v1',{p_actor:actor.id});
 if(body.action==='official-list')return matchRPC(db,'list_official_competitions_v1',{p_actor:actor.id});
 if(body.action==='official-runner-status')return matchRPC(db,'scheduled_official_status_v1',{p_actor:actor.id});
 if(body.action==='official-runner-control')return matchRPC(db,'control_scheduled_official_v1',{p_actor:actor.id,p_paused:body.paused,p_reason:body.reason});
 if(body.action==='official-runner-retry')return matchRPC(db,'retry_scheduled_official_v1',{p_actor:actor.id,p_job:uuid(body.jobId),p_reason:body.reason});
 if(body.action==='official-register-inaugural')return matchRPC(db,'register_inaugural_tournament_v1',{p_actor:actor.id,p_id:uuid(body.competitionId),p_season:uuid(body.seasonId)});
 if(body.action==='official-advance'){
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw new RequestError('Current category journal revision required');
  return matchRPC(db,'advance_official_tournament_v1',{p_actor:actor.id,p_competition:uuid(body.competitionId),p_expected_revision:body.expectedRevision});
 }
 if(body.action==='official-create'){
  if(typeof body.name!=='string'||body.name.length>160||!Array.isArray(body.fixtures)||body.fixtures.length<1||body.fixtures.length>500)throw new RequestError('Name and explicit official fixtures required');
  const fixtures=body.fixtures.map((f:any)=>({id:uuid(f.id),roundId:f.roundId,matchDate:f.matchDate,teamIds:Array.isArray(f.teamIds)?f.teamIds.map(uuid):[]}));
  return matchRPC(db,'create_official_competition_v1',{p_actor:actor.id,p_id:uuid(body.competitionId),p_season:uuid(body.seasonId),p_name:body.name,p_fixtures:fixtures,p_format:body.formatDecision??null});
 }
 if(body.action==='official-activate'){
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw new RequestError('Current competition revision required');
  // Official scoped read prevents this adapter from activating an exhibition.
  await workflow.read(db,actor,uuid(body.competitionId));
  return matchRPC(db,'activate_competition_v1',{p_actor:actor.id,p_competition_id:body.competitionId,p_expected_revision:body.expectedRevision});
 }
 const action=String(body.action).slice('official-'.length);
 if(!delegated.includes(action))throw new RequestError('Unknown official action');
 if(action==='simulate')await matchRPC(db,'check_official_tournament_fixture_v1',{p_actor:actor.id,p_fixture:uuid(body.fixtureId)});
 if(action==='detail'){
  const detail=await handleCompetitiveWorkflow(db,actor,{...body,action:'rehearsal-detail',rehearsalId:uuid(body.competitionId)},workflow);
  const tournament=await matchRPC(db,'read_official_tournament_v1',{p_actor:actor.id,p_competition:body.competitionId});
  if(tournament){
   const records=tournament.seeds.map((team:{teamId:string;name:string})=>detail.records.find((r:{teamId:string})=>r.teamId===team.teamId)??{teamId:team.teamId,name:team.name,played:0,wins:0,losses:0,pointsFor:0,pointsAgainst:0});
   return {...detail,records,tournament};
  }
  return {...detail,tournament};
 }
 return handleCompetitiveWorkflow(db,actor,{...body,action:`rehearsal-${action}`,rehearsalId:uuid(body.competitionId)},workflow);
}
