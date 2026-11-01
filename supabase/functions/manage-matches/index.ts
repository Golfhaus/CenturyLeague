import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.118.0/cors';
import { handleMatchAction, RequestError } from './service.ts';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:corsHeaders});
function key(name:string,fallback:string):string {
  const encoded=Deno.env.get(name),value=encoded?JSON.parse(encoded).default:Deno.env.get(fallback);
  if(!value)throw Error('Backend configuration unavailable');return value;
}
export default {async fetch(req:Request):Promise<Response>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try {
  const authorization=req.headers.get('Authorization')??'';
  if(!/^Bearer \S+$/i.test(authorization))return json({error:'Authenticated session required'},401);
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const userClient=createClient(Deno.env.get('SUPABASE_URL')!,key('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'),{...options,global:{headers:{Authorization:authorization}}});
  const {data:{user},error}=await userClient.auth.getUser(authorization.slice(7));
  if(error||!user)return json({error:'Authenticated session is invalid or expired'},401);
  const {data:registration,error:roleError}=await userClient.from('app_users').select('role').eq('user_id',user.id).maybeSingle();
  if(roleError)throw Error('Unable to verify authorization');
  if(!registration)return json({error:'Registered CenturyLeague access required'},403);
  // Bound creation/ID requests. Result JSON is always generated or loaded by the backend.
  if(Number(req.headers.get('content-length')??0)>65536)return json({error:'Request too large'},413);
  const text=await req.text();if(new TextEncoder().encode(text).length>65536)return json({error:'Request too large'},413);
  let body;try{body=JSON.parse(text);}catch{return json({error:'Valid JSON required'},400);}
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,key('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY'),options);
  return json(await handleMatchAction(admin,{id:user.id,role:registration.role},body));
 } catch(error) {
  if(error instanceof RequestError)return json({error:error.message},error.status);
  console.error('manage-matches request failed',error instanceof Error?error.message:'unknown');
  return json({error:'Match operation failed; refresh and retry. Existing accepted results are preserved.'},500);
 }
}};
