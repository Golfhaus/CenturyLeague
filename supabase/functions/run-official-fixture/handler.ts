import {runScheduledOfficialMatch} from '../manage-matches/scheduled-worker.ts';
import type {MatchDB} from '../manage-matches/shared.ts';

type Failure = {event:'scheduled_runner_failure';stage:'backend'|'claim'|'workflow'|'finish';code:string};
/** Only fixed stage names and validated error codes leave this boundary. */
export function createRunnerHandler(createBackend:()=>MatchDB, report:(failure:Failure)=>void=console.error){
 return async(req:Request):Promise<Response>=>{
  if(req.method!=='POST')return Response.json({error:'POST required'},{status:405});
  const header=req.headers.get('Authorization')??'';
  if(!/^Bearer [a-f0-9]{64}$/.test(header))return Response.json({error:'Runner authentication required'},{status:401});
  let stage:Failure['stage']='backend',code='backend_unavailable',authenticationFailure=false;
  try{
   const backend=createBackend();
   const db:MatchDB={rpc:async(name,args)=>{
    stage=name==='claim_scheduled_official_v1'?'claim':name==='finish_scheduled_official_v1'?'finish':'workflow';
    code='transport_failure';
    const reply=await backend.rpc(name,args);
    if(reply.error){
     const raw=reply.error.code;
     code=typeof raw==='string'&&/^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(raw)?raw:'database_error';
     authenticationFailure=name==='claim_scheduled_official_v1'&&reply.error.message==='Runner authentication required';
     report({event:'scheduled_runner_failure',stage,code});
    }
    return reply;
   }};
   return Response.json(await runScheduledOfficialMatch(db,header.slice(7)));
  }catch{
   if(authenticationFailure)return Response.json({error:'Runner authentication required'},{status:401});
   const failure:Failure={event:'scheduled_runner_failure',stage,code};
   report(failure);
   return Response.json({error:'Runner could not complete this invocation; saved work is retained',stage,code},{status:503});
  }
 };
}
