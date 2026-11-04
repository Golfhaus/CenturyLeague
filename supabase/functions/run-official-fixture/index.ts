import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {createRunnerHandler} from './handler.ts';
// Dedicated Vault-held bearer token, verified by backend-only database RPCs.
// User JWTs, publishable keys, fixture IDs and client-provided results are not accepted.
export default {fetch:createRunnerHandler(()=>{
  const encoded=Deno.env.get('SUPABASE_SECRET_KEYS');
  const secret=encoded?JSON.parse(encoded).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!secret)throw Error('Runner backend unavailable');
  const db=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  return db;
})};
