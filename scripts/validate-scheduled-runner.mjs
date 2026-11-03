import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import pg from 'pg';
import {input as sample} from './replay-runtime-probe.mjs';
import {runScheduledOfficialMatch} from '../supabase/functions/manage-matches/scheduled-worker.ts';
const url=process.env.COMPETITION_TEST_DATABASE_URL;
if(url&&!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Disposable localhost database required');
const database='century_runner_'+randomUUID().replaceAll('-',''),admin=url?new pg.Client({connectionString:url}):null;
let testURL=url;if(admin){await admin.connect();await admin.query('create database '+database);const u=new URL(url);u.pathname='/'+database;testURL=u.toString();}
const client=testURL?new pg.Client({connectionString:testURL}):null;if(client)await client.connect();
const db=client?{query:(q,p)=>client.query(q,p),exec:q=>client.query(q),close:()=>client.end()}:new PGlite();
let checks=0;const check=x=>{assert.ok(x);checks++;},eq=(a,b)=>{assert.deepEqual(a,b);checks++;},rejects=async(f,re)=>{await assert.rejects(f,re);checks++;};
const actor=randomUUID(),season=randomUUID(),competition=randomUUID(),vault=randomUUID(),token='a'.repeat(64);
const rpcOn=connection=>({rpc:async(name,args)=>{try{const keys=Object.keys(args),values=keys.map(k=>typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);return {data:(await connection.query(`select public.${name}(${keys.map((k,i)=>k+'=>$'+(i+1)).join(',')}) receipt`,values)).rows[0].receipt,error:null};}catch(e){return {data:null,error:{message:e.message,code:e.code}};}}});
const adapter=rpcOn(db),rpc=async(name,args)=>{const r=await adapter.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;};
const setClock=async at=>{await db.exec('reset role');await db.query(`create or replace function private.scheduled_official_now_v1() returns timestamptz language sql stable security invoker set search_path='' as $$ select '${at}'::timestamptz $$`);await db.exec('set role service_role');};
const claim=()=>rpc('claim_scheduled_official_v1',{p_token:token});
const finish=(c,outcome='retry',code='test_transient')=>rpc('finish_scheduled_official_v1',{p_token:token,p_job:c.jobId,p_lease:c.leaseId,p_outcome:outcome,p_code:code});
const fenced=(c,name,args)=>rpc('scheduled_official_rpc_v1',{p_token:token,p_job:c.jobId,p_lease:c.leaseId,p_rpc:name,p_args:{p_actor:actor,...args}});
try{
 await db.exec(fs.readFileSync('supabase/tests/competition-bootstrap.sql','utf8').replace(/create role (anon|authenticated|service_role)([^;]*);/g,(_,role,options)=>`do $bootstrap$ begin if not exists(select 1 from pg_roles where rolname='${role}') then create role ${role}${options}; end if; end $bootstrap$;`));
 for(const f of ['20261101185535_competition_result_acceptance.sql','20261102013314_competition_operations_candidate.sql','20261102022215_integrate_competitive_rehearsals.sql','20261102111203_official_competition_registry.sql','20261102132159_adopt_calendar_recovery_v1.sql','20261103111414_inaugural_tournament_v1.sql','20261103131011_allow_tournament_detail_authorization_lock.sql','20261103134708_scheduled_official_runner_v1.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec(`create schema vault;create table vault.decrypted_secrets(id uuid primary key,decrypted_secret text);
 create schema net;create table net.test_requests(id bigint generated always as identity,url text,authenticated boolean);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$ declare rid bigint;begin insert into net.test_requests(url,authenticated) values(url,headers->>'Authorization'='Bearer '||repeat('a',64)) returning id into rid;return rid;end $$;`);
 await db.query("insert into app_users values($1,'commissioner')",[actor]);
 await db.query("insert into seasons values($1,'setup','men','2026-11-01')",[season]);
 const template=JSON.parse(fs.readFileSync('docs/inaugural-tournament-v1.json'));
 for(const seed of template.seeds){const t=structuredClone(sample.teams[seed.seed%2]);t.id=randomUUID();t.name=seed.name;t.players.forEach(p=>p.id=randomUUID());await db.query("insert into teams values($1,$2,'men')",[t.id,t.name]);await db.query('insert into team_season_rosters values($1,$2,$3,$4)',[randomUUID(),season,t.id,JSON.stringify(t)]);}
 await db.query('select register_inaugural_tournament_v1($1,$2,$3)',[actor,competition,season]);
 const stream=(await db.query('select stream_id from private.official_competition_bindings where competition_id=$1',[competition])).rows[0].stream_id;
 await db.query('insert into vault.decrypted_secrets values($1,$2)',[vault,token]);
 await db.query(`insert into private.scheduled_official_control(competition_id,actor_id,stream_id,token_sha256,vault_secret_id,endpoint_url) values($1,$2,$3,encode(sha256(convert_to($4,'UTF8')),'hex'),$5,'https://test.supabase.co/functions/v1/run-official-fixture')`,[competition,actor,stream,token,vault]);
 // Fixed test clock models both before/after 7pm Eastern, without live writes.
 const original=fs.readFileSync('supabase/migrations/20261103111414_inaugural_tournament_v1.sql','utf8').match(/create function private\.require_inaugural_due_v1[\s\S]*?end \$\$;/)[0];
 await db.exec(original.replace('create function','create or replace function').replace('now()','private.scheduled_official_now_v1()'));
 await db.exec('set role service_role');
 await rejects(()=>rpc('claim_scheduled_official_v1',{p_token:'b'.repeat(64)}),/authentication/);
 eq((await claim()).status,'paused');
 await rejects(()=>db.query('update private.scheduled_official_control set enabled=true'),/permission denied/);
 await db.exec('reset role');await db.exec("update private.official_release_gates set activation_enabled=true where category='men';update private.scheduled_official_control set enabled=true;");
 await db.query('select activate_competition_v1($1,$2,0)',[actor,competition]);
 await setClock('2026-11-03T23:59:59Z');eq((await claim()).status,'idle');eq((await db.query('select count(*)::int n from private.scheduled_official_jobs')).rows[0].n,0);
 await setClock('2026-11-04T00:00:00Z');const first=await claim();eq(first.status,'claimed');eq((await claim()).status,'busy');
 eq((await db.query('select count(*)::int n from private.scheduled_official_jobs')).rows[0].n,8);
 await rejects(()=>fenced(first,'activate_competition_v1',{}),/not allowed/);
 await rejects(()=>fenced(first,'read_official_competition_v1',{p_id:randomUUID()}),/scope|competition/);
 await rejects(()=>fenced(first,'append_operation_candidate_v1',{p_stream_id:stream,p_event:{operation:{type:'discipline'}}}),/commissioner decisions/);
 await rejects(()=>finish(first,'accepted'),/No accepted source/);
 await setClock('2026-11-04T00:03:01Z');const second=await claim();eq(second.fixtureId,first.fixtureId);check(second.leaseId!==first.leaseId);eq(second.commandId,first.commandId);
 await rejects(()=>fenced(first,'read_official_competition_v1',{p_id:competition}),/lease/);
 await rejects(()=>finish(first),/lease/);
 await finish(second,'blocked','commissioner_review');
 let status=await rpc('scheduled_official_status_v1',{p_actor:actor});eq(status.jobs[0].status,'blocked');check(!JSON.stringify(status).includes(token));
 const paused=await rpc('control_scheduled_official_v1',{p_actor:actor,p_paused:true,p_reason:'Disposable test pause of automatic execution'});check(paused.paused);eq((await claim()).status,'paused');
 await rpc('retry_scheduled_official_v1',{p_actor:actor,p_job:second.jobId,p_reason:'Disposable manual retry preserves the saved fixture seed'});
 await rpc('control_scheduled_official_v1',{p_actor:actor,p_paused:false,p_reason:'Disposable test resume after commissioner review'});
 const lostReply={rpc:async(name,args)=>{const r=await adapter.rpc(name,args);if(name==='scheduled_official_rpc_v1'&&args.p_rpc==='append_operation_candidate_v1'&&!r.error)throw Error('Lost successful reply');return r;}};
 const worked=await runScheduledOfficialMatch(lostReply,token);eq(worked.status,'accepted');
 eq((await db.query('select count(*)::int n from public.official_result_dispositions')).rows[0].n,1);
 status=await rpc('scheduled_official_status_v1',{p_actor:actor});const accepted=status.jobs.find(j=>j.status==='accepted');check(Boolean(accepted));
 await rejects(()=>rpc('retry_scheduled_official_v1',{p_actor:actor,p_job:accepted.id,p_reason:'An accepted result must never be rerun'}),/unaccepted/);
 const blockedAdapter={rpc:async(name,args)=>name==='scheduled_official_rpc_v1'&&args.p_rpc==='check_official_tournament_fixture_v1'?{data:null,error:{message:'Resolve the affected incident and match reviews before the next match'}}:adapter.rpc(name,args)};
 eq((await runScheduledOfficialMatch(blockedAdapter,token)).status,'blocked');
 const third=await claim();await db.exec('reset role');await db.query('update private.scheduled_official_jobs set max_attempts=attempts where id=$1',[third.jobId]);await db.exec('set role service_role');eq((await finish(third,'retry','transient_failure')).status,'failed');
 eq((await db.query('select count(*)::int n from private.scheduled_official_jobs where scheduled_for>private.scheduled_official_now_v1()')).rows[0].n,0);
 await db.exec('reset role');check((await db.query('select count(*)::int n from net.test_requests where authenticated')).rows[0].n>=1);
 const stats=(await db.query('select p.result from public.match_proposals p join public.match_results r on r.proposal_id=p.id')).rows[0].result;
 eq(stats.players.length,70);eq(stats.players.reduce((n,p)=>n+(p.stats.points??0),0),stats.scores[0]+stats.scores[1]);
 await db.exec('set role authenticated');
 for(const q of ['select * from private.scheduled_official_control','select claim_scheduled_official_v1(\'fake\')','select scheduled_official_status_v1(\''+actor+'\')','select private.dispatch_scheduled_official_v1()'])await rejects(()=>db.query(q),/permission denied/);
 if(url){
  await db.exec('reset role');await db.query("update private.scheduled_official_control set lease_until='2000-01-01'");
  const connections=[new pg.Client({connectionString:testURL}),new pg.Client({connectionString:testURL})];
  try{await Promise.all(connections.map(async c=>{await c.connect();await c.query('set role service_role');}));const replies=await Promise.all(connections.map(async c=>{const r=await rpcOn(c).rpc('claim_scheduled_official_v1',{p_token:token});if(r.error)throw Error(r.error.message);return r.data;}));eq(replies.filter(r=>r.status==='claimed').length,1);eq(replies.filter(r=>r.status==='busy').length,1);}finally{await Promise.all(connections.map(c=>c.end()));}
 }
 console.log(JSON.stringify({status:'passed',checks,database:url?'isolated PostgreSQL':'isolated PostgreSQL/WASM',liveWrites:0,concurrentClaims:Boolean(url),lostAcceptanceReplyRecovered:true,officialMatchesInDisposableDatabase:1}));
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close();if(admin){await admin.query('drop database '+database);await admin.end();}}
