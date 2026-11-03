import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {runScheduledOfficialMatch} from '../manage-matches/scheduled-worker.ts';
// Dedicated Vault-held bearer token, verified by backend-only database RPCs.
// User JWTs, publishable keys, fixture IDs and client-provided results are not accepted.
export default {async fetch(req:Request):Promise<Response>{
 if(req.method!=='POST')return Response.json({error:'POST required'},{status:405});
 const header=req.headers.get('Authorization')??'';
 if(!/^Bearer [a-f0-9]{64}$/.test(header))return Response.json({error:'Runner authentication required'},{status:401});
 try{
  const encoded=Deno.env.get('SUPABASE_SECRET_KEYS');
  const secret=encoded?JSON.parse(encoded).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!secret)throw Error('Runner backend unavailable');
  const db=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  return Response.json(await runScheduledOfficialMatch(db,header.slice(7)));
 }catch(error){
  // Never log request headers, tokens, SQL arguments or complete match ledgers.
  if(error instanceof Error&&error.message==='Runner authentication required')return Response.json({error:'Runner authentication required'},{status:401});
  return Response.json({error:'Runner could not complete this invocation; saved work is retained'},{status:503});
 }
}};
