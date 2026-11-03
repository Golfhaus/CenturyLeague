import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolveEntrants,divisions,validateDraws} from './lib/inaugural-bracket.mjs';
import {PGlite} from '@electric-sql/pglite';
import pg from 'pg';
import {input as sample} from './replay-runtime-probe.mjs';
import {handleMatchAction} from '../supabase/functions/manage-matches/service.ts';
const url=process.env.COMPETITION_TEST_DATABASE_URL;
if(url&&!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Disposable localhost database required');
// PostgreSQL runs get a private disposable database, separate from prior suites.
const testDatabase='century_inaugural_'+randomUUID().replaceAll('-','');
const admin=url?new pg.Client({connectionString:url}):null;
let testURL=url;
if(admin){await admin.connect();await admin.query('create database '+testDatabase);const u=new URL(url);u.pathname='/'+testDatabase;testURL=u.toString();}
const client=testURL?new pg.Client({connectionString:testURL}):null;if(client)await client.connect();
const db=client?{query:(q,p)=>client.query(q,p),exec:q=>client.query(q),close:()=>client.end()}:new PGlite();
let checks=0;const check=x=>{assert.ok(x);checks++;};const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};const rejects=async(f,re)=>{await assert.rejects(f,re);checks++;};
const actor={id:randomUUID(),role:'commissioner'},viewer={id:randomUUID(),role:'viewer'},competition=randomUUID(),season=randomUUID();
const template=JSON.parse(fs.readFileSync('docs/inaugural-tournament-v1.json'));
const structural=validateDraws(template);
console.log(JSON.stringify({structural}));
const rpcOn=connection=>({rpc:async(name,args)=>{try{const keys=Object.keys(args),values=keys.map(k=>typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);return {data:(await connection.query(`select public.${name}(${keys.map((k,i)=>k+'=>$'+(i+1)).join(',')}) receipt`,values)).rows[0].receipt,error:null};}catch(e){return {data:null,error:{message:e.message,code:e.code}};}}});
const adapter=rpcOn(db),act=body=>handleMatchAction(adapter,actor,{competitionId:competition,...body});
const detail=()=>act({action:'official-detail'}),advance=async()=>act({action:'official-advance',expectedRevision:(await detail()).revision});
const operate=async operation=>act({action:'official-command',operation,commandId:randomUUID(),expectedRevision:(await detail()).revision});
const dismiss=async()=>{for(const c of (await detail()).incidents)await operate({type:'discipline',caseId:c.id,matches:0,reason:'Disposable validation only: no named-offense sanction is inferred from the flag'});};
try{
 if(!(await db.query("select to_regclass('public.competitions') t")).rows[0].t){await db.exec(fs.readFileSync('supabase/tests/competition-bootstrap.sql','utf8').replace(/create role (anon|authenticated|service_role)([^;]*);/g,(_,role,options)=>`do $bootstrap$ begin if not exists(select 1 from pg_roles where rolname='${role}') then create role ${role}${options}; end if; end $bootstrap$;`));await db.exec(fs.readFileSync('supabase/migrations/20261101185535_competition_result_acceptance.sql','utf8'));}
 for(const [table,file] of [['private.competition_operation_streams_candidate','20261102013314_competition_operations_candidate.sql'],['private.competitive_rehearsals','20261102022215_integrate_competitive_rehearsals.sql'],['private.official_release_gates','20261102111203_official_competition_registry.sql']]){
  if(!(await db.query('select to_regclass($1) t',[table])).rows[0].t)await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 }
 await db.exec('reset role');
 await db.exec(fs.readFileSync('supabase/migrations/20261102132159_adopt_calendar_recovery_v1.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261103111414_inaugural_tournament_v1.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261103131011_allow_tournament_detail_authorization_lock.sql','utf8'));
 check((await db.query("select provolatile from pg_proc where oid='public.read_official_tournament_v1(uuid,uuid)'::regprocedure")).rows[0].provolatile==='v');
 await db.query('insert into app_users values($1,$3),($2,$4)',[actor.id,viewer.id,'commissioner','viewer']);
 await db.query("insert into seasons values($1,'setup','men','2026-11-01')",[season]);
 for(const seed of template.seeds){
  const team=structuredClone(sample.teams[seed.seed%2]);team.id=randomUUID();team.name=seed.name;
  team.players.forEach(p=>{p.id=randomUUID();});
  await db.query("insert into teams values($1,$2,'men')",[team.id,team.name]);
  await db.query('insert into team_season_rosters values($1,$2,$3,$4)',[randomUUID(),season,team.id,JSON.stringify(team)]);
 }
 // Exercise due-time behavior against a fixed pre-opening clock in this disposable DB.
 const migration=fs.readFileSync('supabase/migrations/20261103111414_inaugural_tournament_v1.sql','utf8');
 const due=migration.match(/create function private\.require_inaugural_due_v1[\s\S]*?end \$\$;/)[0];
 await db.exec(due.replace('create function','create or replace function').replace('now()',"'2026-11-02T00:00:00Z'::timestamptz"));
 await db.exec('set role service_role');
 await rejects(()=>handleMatchAction(adapter,viewer,{action:'official-register-inaugural',competitionId:competition,seasonId:season}),/Commissioner/);
 const reg={action:'official-register-inaugural',seasonId:season};check((await act(reg)).added);check(!(await act(reg)).added);
 let d=await detail();eq(d.fixtures.length,8);eq(d.tournament.slots.length,39);eq(d.status,'draft');eq(d.tournament.complete,false);eq(d.records.length,18);eq(d.records.reduce((n,r)=>n+r.played,0),0);
 eq(d.tournament.slots.map(s=>s.startsAt),template.slots.map(s=>s.startsAt));
 eq((await db.query('select count(*)::integer n from competition_rosters where competition_id=$1',[competition])).rows[0].n,18);
 await rejects(()=>act({action:'official-activate',expectedRevision:0}),/disabled/);
 await rejects(()=>act({action:'official-simulate',fixtureId:d.fixtures[0].id}),/time has not arrived|Activate/);
 eq((await advance()).added,0);
 await rejects(()=>act({...reg,competitionId:randomUUID()}),/duplicate key/);
 const gate=(await act({action:'official-readiness'})).find(g=>g.category==='women');check(!gate.formatApproved&&!gate.activationEnabled&&!gate.hasJournal);
 const originalFormat=(await db.query('select definition->\'formatDecision\' f from competitions where id=$1',[competition])).rows[0].f;
 const opening=(await db.query('select definition->\'fixtures\' f from competitions where id=$1',[competition])).rows[0].f;
 await rejects(()=>act({action:'official-create',competitionId:randomUUID(),seasonId:season,name:'Tampered span',fixtures:opening,formatDecision:{...originalFormat,endsOn:'2027-01-01'}}),/Exact approved/);
 await rejects(()=>advanceWithStale(),/changed/);
 async function advanceWithStale(){return act({action:'official-advance',expectedRevision:999});}
 if(process.argv.includes('--registration-only')){console.log(JSON.stringify({status:'passed',checks,mode:'registration-only',liveWrites:0}));} else {
 // Owner-only disposable clock replacement. Production due-time gate is tested
 // above and never disabled in a deployment. Move only the test clock past all dates.
 await db.exec('reset role');
 await db.exec("update private.official_release_gates set activation_enabled=true where category='men'");
 await db.exec(`create or replace function private.require_inaugural_due_v1(p_fixture uuid) returns void language plpgsql stable security invoker set search_path='' as $$ begin perform private.assert_inaugural_fixture_v1(p_fixture); end $$`);
 await db.exec('set role service_role');
 await act({action:'official-activate',expectedRevision:0});
 // Both closure layers must reject a partially prepared tournament.
 await rejects(()=>operate({type:'close',reason:'Validation should reject incomplete bracket slots'}),/Pending|complete|before closure/);
 let simulated=0,firstProposal;const outcomes={};
 for(let window=1;window<=10;window++){
  console.log(JSON.stringify({window,simulated}));
  await advance();d=await detail();
  for(const slot of d.tournament.slots.filter(s=>s.window===window&&s.status==='scheduled')){
   await dismiss();
   const p=await act({action:'official-simulate',fixtureId:slot.fixtureId});
   const source=await act({action:'official-proposal',proposalId:p.id});
   const seeds=resolveEntrants(template,template.slots.find(s=>s.code===slot.code),outcomes);
   eq(slot.teamIds.map(id=>d.tournament.seeds.find(s=>s.teamId===id).seed),seeds);
   outcomes[slot.code]={winner:seeds[source.result.winner],loser:seeds[1-source.result.winner]};
   eq(source.result.players.length,70);eq(Math.max(...source.result.scores),100);
   check(source.result.scores.some(n=>n<100));
   const result=await act({action:'official-accept',proposalId:p.id,commandId:randomUUID(),expectedRevision:(await detail()).revision});check(result.added);
   check(!(await act({action:'official-accept',proposalId:p.id,commandId:randomUUID(),expectedRevision:0})).added);
   if(!firstProposal)firstProposal=p.id;
   simulated++;
  }
 }
 await dismiss();d=await detail();check(d.tournament.complete);check(Boolean(d.tournament.champion));check([38,39].includes(simulated));
 eq(Object.values(d.tournament.divisions).map(a=>a.length),[2,4,4,4,4]);
 eq(Object.fromEntries(Object.entries(d.tournament.divisions).map(([division,ids])=>[division,ids.map(id=>d.tournament.seeds.find(s=>s.teamId===id).seed)])),divisions(outcomes));
 eq(new Set(Object.values(d.tournament.divisions).flat()).size,18);
 check(!Object.values(d.tournament.divisions).flat().includes(null));
 const reset=d.tournament.slots.at(-1);eq(reset.status,simulated===39?'accepted':'not-needed');
 check((await act({action:'official-verify',proposalId:firstProposal})).replay.equivalent);
 const briefing=await act({action:'official-briefing',roundId:'Window 1'});eq(briefing.acceptedMatches,8);eq(briefing.pendingFixtures,0);
 check(briefing.playerTotals.length===560);
 await operate({type:'close',reason:'Disposable complete inaugural tournament validation'});eq((await detail()).status,'closed');
 await rejects(()=>advance(),/Open inaugural/);
 await operate({type:'reopen',reason:'Disposable correction and dependent route validation'});
 const first=(await detail()).fixtures.find(f=>f.proposalId===firstProposal);
 await operate({type:'correct',resultId:first.acceptedId,kind:'technical',reason:'Disposable source correction must block any now-unresolved dependent fixture'});
 const corrected=await detail();check(!corrected.tournament.complete);check(corrected.reviews.length>0);
 const dependent=corrected.tournament.slots.find(s=>s.routes.some(r=>r==='W M01'||r==='W:M01'));
 await rejects(()=>act({action:'official-simulate',fixtureId:dependent.fixtureId}),/current approved bracket/);
 await rejects(()=>operate({type:'close',reason:'A voided source must not let a tournament close'}),/Pending|complete|before closure/);
 const afterVoid=await act({action:'official-briefing',roundId:'Window 1'});eq(afterVoid.acceptedMatches,7);
 // Same immutable source replay and no byes in result totals.
 eq(d.records.reduce((n,r)=>n+r.played,0),simulated*2);
 await db.exec('reset role; set role authenticated');
 await rejects(()=>db.query('select register_inaugural_tournament_v1($1,$2,$3)',[actor.id,competition,season]),/permission denied/);
 await rejects(()=>db.query('select advance_official_tournament_v1($1,$2,0)',[actor.id,competition]),/permission denied/);
 await rejects(()=>db.query('select private.inaugural_template_v1()'),/permission denied/);
 console.log(JSON.stringify({status:'passed',checks,simulated,reset:simulated===39,database:url?'isolated PostgreSQL':'isolated PostgreSQL/WASM',liveWrites:0}));
 }
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close();if(admin){await admin.query('drop database '+testDatabase);await admin.end();}}
