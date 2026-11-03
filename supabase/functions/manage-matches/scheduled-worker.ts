import {handleOfficialAction} from './official-service.ts';
import {RequestError,matchRPC} from './shared.ts';
import type {MatchDB} from './shared.ts';

type Claim={status:string;jobId:string;leaseId:string;competitionId:string;fixtureId:string;actorId:string;commandId:string};
/** A single due match per invocation. All RPCs are fenced by the current lease. */
export async function runScheduledOfficialMatch(db:MatchDB,token:string){
 const claim:Claim=await matchRPC(db,'claim_scheduled_official_v1',{p_token:token});
 if(claim.status!=='claimed')return {status:claim.status};
 const scoped:MatchDB={rpc:(name,args)=>db.rpc('scheduled_official_rpc_v1',{
  p_token:token,p_job:claim.jobId,p_lease:claim.leaseId,p_rpc:name,p_args:args
 })};
 const actor={id:claim.actorId,role:'commissioner'};
 const act=(body:Record<string,unknown>)=>handleOfficialAction(scoped,actor,{competitionId:claim.competitionId,...body});
 let outcome='accepted',code='completed';
 try{
  const detail=await act({action:'official-detail'});
  const fixture=detail.fixtures.find((f:{id:string})=>f.id===claim.fixtureId);
  if(!fixture)throw new RequestError('Unknown scheduled fixture');
  if(fixture.status==='superseded'){outcome='superseded';code='superseded';}
  else if(fixture.status==='voided')throw new RequestError('Voided source requires commissioner replacement');
  else if(fixture.status!=='accepted'){
   const proposal=await act({action:'official-simulate',fixtureId:claim.fixtureId});
   const fresh=await act({action:'official-detail'});
   await act({action:'official-accept',proposalId:proposal.id,commandId:claim.commandId,expectedRevision:fresh.revision});
  }
 }catch(error){
  const message=error instanceof Error?error.message:'';
  if(/Resolve the affected incident|match reviews|review required/.test(message)){outcome='blocked';code='commissioner_review';}
  else if(/Eligibility changed|approved bracket|reopen|roster|original adapter|engine source|safety|aborted|Voided|superseded/i.test(message)){outcome='failed';code='commissioner_recovery';}
  else if(error instanceof RequestError&&error.status===400){outcome='failed';code='invalid_operation';}
  else {outcome='retry';code='transient_failure';}
 }
 const receipt=await matchRPC(db,'finish_scheduled_official_v1',{p_token:token,p_job:claim.jobId,p_lease:claim.leaseId,p_outcome:outcome,p_code:code});
 return {status:receipt.status,jobId:claim.jobId};
}
