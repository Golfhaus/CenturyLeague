import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import pg from 'pg';
import {input as sample} from './replay-runtime-probe.mjs';
import {handleMatchAction} from '../supabase/functions/manage-matches/service.ts';
import {APPROVED_RECOVERY_POLICY,CANDIDATE_RECOVERY_POLICY} from '../packages/simulation-core/dist/competitive/index.js';
const url=process.env.COMPETITION_TEST_DATABASE_URL;
if(url&&!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Disposable localhost database required');
const client=url?new pg.Client({connectionString:url}):null;if(client)await client.connect();
const db=client?{query:(q,p)=>client.query(q,p),exec:q=>client.query(q),close:()=>client.end()}:new PGlite();
let checks=0;const check=x=>{assert.ok(x);checks++;};const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};const rejects=async(f,re)=>{await assert.rejects(f,re);checks++;};
const actor={id:randomUUID(),role:'commissioner'},viewer={id:randomUUID(),role:'viewer'};
const firstCompetition='10000000-0000-4000-8000-000000000001',nextCompetition=randomUUID();
const firstFixture='20000000-0000-4000-8000-000000000012',nextFixtures=[randomUUID(),randomUUID()];
const months=[randomUUID(),randomUUID()],teams=structuredClone(sample.teams);let journal;
const rpcOn=connection=>({rpc:async(name,args)=>{
 try{const keys=Object.keys(args),values=keys.map(k=>typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);
 return {data:(await connection.query(`select public.${name}(${keys.map((k,i)=>k+'=>$'+(i+1)).join(',')}) receipt`,values)).rows[0].receipt,error:null};
 }catch(e){return {data:null,error:{message:e.message,code:e.code}};}
},from(){throw Error('Official service must use backend-only RPCs');}});
const adapter=rpcOn(db),act=(body,other=adapter)=>handleMatchAction(other,actor,body);
const detail=competitionId=>act({action:'official-detail',competitionId});
const propose=(competitionId,fixtureId)=>act({action:'official-simulate',competitionId,fixtureId,result:{scores:[100,0]},config:{injuryChancePerContest:1}});
const proposal=(competitionId,proposalId)=>act({action:'official-proposal',competitionId,proposalId});
const accept=async(competitionId,proposalId,other=adapter)=>act({action:'official-accept',competitionId,proposalId,commandId:randomUUID(),expectedRevision:(await detail(competitionId)).revision},other);
const operate=async(competitionId,operation)=>act({action:'official-command',competitionId,operation,commandId:randomUUID(),expectedRevision:(await detail(competitionId)).revision});
const dismiss=async competitionId=>{for(const c of (await detail(competitionId)).incidents)await operate(competitionId,{type:'discipline',caseId:c.id,matches:0,reason:'Validation only: recorded flag does not establish an approved named offense'});};
const counts=async()=>(await db.query(`select jsonb_build_object('events',(select count(*) from private.competition_operation_events_candidate where stream_id=$1),
 'head',(select head_sha256 from private.competition_operation_streams_candidate where id=$1),'results',(select count(*) from public.match_results a join public.competition_fixtures f on f.id=a.fixture_id join private.official_competition_bindings b on b.competition_id=f.competition_id where b.stream_id=$1),
 'dispositions',(select count(*) from public.official_result_dispositions where stream_id=$1)) snapshot`,[journal])).rows[0].snapshot;
try{
 if(!(await db.query("select to_regclass('public.competitions') t")).rows[0].t){await db.exec(fs.readFileSync('supabase/tests/competition-bootstrap.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/20261101185535_competition_result_acceptance.sql','utf8'));}
 if(!(await db.query("select to_regclass('private.competition_operation_streams_candidate') t")).rows[0].t)await db.exec(fs.readFileSync('supabase/migrations/20261102013314_competition_operations_candidate.sql','utf8'));
 if(!(await db.query("select to_regclass('private.competitive_rehearsals') t")).rows[0].t)await db.exec(fs.readFileSync('supabase/migrations/20261102022215_integrate_competitive_rehearsals.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261102111203_official_competition_registry.sql','utf8'));
 await db.query('insert into app_users values($1,$3),($2,$4)',[actor.id,viewer.id,'commissioner','viewer']);
 for(let i=0;i<months.length;i++)await db.query("insert into seasons values($1,'setup','men',$2)",[months[i],i?'2026-12-01':'2026-11-01']);
 for(const t of teams){t.id=randomUUID();await db.query("insert into teams values($1,$2,'men')",[t.id,t.name]);await db.query('insert into team_season_rosters values($1,$2,$3,$4)',[randomUUID(),months[0],t.id,JSON.stringify(t)]);}
 const definition={action:'official-create',competitionId:firstCompetition,seasonId:months[0],name:'Disposable official adapter test',fixtures:[{id:firstFixture,roundId:'Round 1',matchDate:'2026-11-30',teamIds:teams.map(t=>t.id)}],formatDecision:{reference:'Disposable validation only: explicit fixtures; no adopted inaugural format',standings:'unranked validation'}};
 await db.exec('set role service_role');
 for(const action of ['official-readiness','official-list','official-create','official-detail','official-accept','official-command'])await rejects(()=>handleMatchAction(adapter,viewer,{action}),/Commissioner/);
 const ready=await act({action:'official-readiness'});check(ready.length===2&&ready.every(g=>!g.activationEnabled&&!g.policyApproved&&!g.formatApproved&&!g.hasJournal));
 await rejects(()=>act(definition),/Official competition disabled/);
 await rejects(()=>db.query("update private.official_release_gates set activation_enabled=true where category='men'"),/permission denied/);
 check((await db.query('select count(*)::integer n from private.official_competition_bindings')).rows[0].n===0);
 const historicalStream=randomUUID();
 await db.query('select create_operations_candidate_v1($1,$2,$3,$4)',[actor.id,historicalStream,'men',JSON.stringify(CANDIDATE_RECOVERY_POLICY)]);
 const history=(await db.query('select * from private.competition_operation_streams_candidate order by id')).rows;
 await db.exec('reset role');
 await db.exec(fs.readFileSync('supabase/migrations/20261102132159_adopt_calendar_recovery_v1.sql','utf8'));
 equal((await db.query('select * from private.competition_operation_streams_candidate order by id')).rows,history);
 const adopted=await act({action:'official-readiness'});
 check(adopted.every(g=>g.policyApproved&&!g.formatApproved&&!g.activationEnabled&&!g.hasJournal));
 for(const gate of adopted)equal(gate.policy,APPROVED_RECOVERY_POLICY);
 await rejects(()=>act(definition),/Official competition disabled/);
 await db.exec('set role service_role');
 await rejects(()=>db.query("update private.official_release_gates set policy_approved=false where category='men'"),/permission denied/);
 await db.exec('reset role');
 await db.exec(fs.readFileSync('supabase/migrations/20261103111414_inaugural_tournament_v1.sql','utf8'));
 // Owner-only switches are confined to this disposable database. No production
 // API or commissioner browser has permission to approve these decisions.
 await db.exec("update private.official_release_gates set policy_approved=true,format_approved=true,activation_enabled=true where category='men'");
 await db.exec('set role service_role');
 check((await act(definition)).added);check(!(await act(definition)).added);
 let d=await detail(firstCompetition);journal=(await db.query('select stream_id from private.official_competition_bindings where competition_id=$1',[firstCompetition])).rows[0].stream_id;
 check(d.id===firstCompetition&&d.status==='draft'&&d.fixtures.length===1);
 equal(d.policy,APPROVED_RECOVERY_POLICY);
 await rejects(()=>propose(firstCompetition,firstFixture),/Activate/);
 await db.exec('reset role');await db.exec("update private.official_release_gates set activation_enabled=false where category='men'");await db.exec('set role service_role');
 await rejects(()=>db.query('select activate_competition_v1($1,$2,0)',[actor.id,firstCompetition]),/Official competition disabled/);
 await rejects(()=>db.query("update competitions set status='active',revision=1 where id=$1",[firstCompetition]),/Official competition disabled/);
 await db.exec('reset role');await db.exec("update private.official_release_gates set activation_enabled=true where category='men'");await db.exec('set role service_role');
 await act({action:'official-activate',competitionId:firstCompetition,expectedRevision:0});
 const p=await propose(firstCompetition,firstFixture),raw=await proposal(firstCompetition,p.id);
 check(raw.result.players.length===70&&raw.result.config.injuryChancePerContest===0.0008);
 check(raw.result.input.provenance.purpose==='official'&&raw.result.input.provenance.competitionId===firstCompetition);
 check(!(await propose(firstCompetition,firstFixture)).added);
 await rejects(()=>db.query('select accept_match_proposal_v1($1,$2,1)',[actor.id,p.id]),/atomic category event/);
 // A failure in the public registration rolls back the category event/head too.
 await db.exec('reset role');await db.exec(`create function private.official_injected_failure() returns trigger language plpgsql as $$ begin raise exception 'Injected official registration failure'; end $$;
 create trigger injected_official_registration before insert on public.match_results for each row execute function private.official_injected_failure()`);await db.exec('set role service_role');
 const before=await counts();await rejects(()=>accept(firstCompetition,p.id),/Injected official registration failure/);equal(await counts(),before);
 await db.exec('reset role');await db.exec('drop trigger injected_official_registration on public.match_results; drop function private.official_injected_failure()');await db.exec('set role service_role');
 const lostReply={...adapter,rpc:async(name,args)=>{const r=await adapter.rpc(name,args);if(name==='append_operation_candidate_v1'&&!r.error)throw Error('Lost successful official reply');return r;}};
 await rejects(()=>accept(firstCompetition,p.id,lostReply),/Lost successful official reply/);
 check(!(await accept(firstCompetition,p.id)).added);check((await counts()).results===1);
 d=await detail(firstCompetition);check(d.injuries.length>0&&d.incidents.length>0);
 const incident=d.incidents.find(c=>!d.injuries.some(i=>i.name===c.name));check(Boolean(incident));
 await operate(firstCompetition,{type:'discipline',caseId:incident.id,matches:2,reason:'Disposable validation only: demonstrate two-match carryover; no league tariff adopted'});await dismiss(firstCompetition);
 d=await detail(firstCompetition);check(d.suspensions.length===1&&d.suspensions[0].remaining===2);
 const suspendedId=raw.result.input.teams.flatMap(t=>t.players).find(p=>p.name===incident.name).id;
 // Same stable player ID moves clubs in the next month's canonical snapshots.
 const nextTeams=structuredClone(teams),sourceSide=nextTeams.findIndex(t=>t.players.some(p=>p.id===suspendedId)),otherSide=1-sourceSide;
 const i=nextTeams[sourceSide].players.findIndex(p=>p.id===suspendedId);
 [nextTeams[sourceSide].players[i],nextTeams[otherSide].players[0]]=[nextTeams[otherSide].players[0],nextTeams[sourceSide].players[i]];
 await db.exec('reset role');
 for(const t of nextTeams)await db.query('insert into team_season_rosters values($1,$2,$3,$4)',[randomUUID(),months[1],t.id,JSON.stringify(t)]);
 await db.exec('set role service_role');
 const nextDefinition={...definition,competitionId:nextCompetition,seasonId:months[1],name:'Next month',fixtures:nextFixtures.map((id,i)=>({id,roundId:`Round ${i+1}`,matchDate:i?'2026-12-03':'2026-12-01',teamIds:teams.map(t=>t.id)}))};
 check((await act(nextDefinition)).added);
 const binding=(await db.query('select stream_id from private.official_competition_bindings where competition_id=$1',[nextCompetition])).rows[0];equal(binding.stream_id,journal);
 let next=await detail(nextCompetition);check(next.records.every(r=>r.played===0)&&next.suspensions[0].remaining===2);
 equal(next.injuries,d.injuries);check(next.fixtures[0].availability.find(p=>p.playerId===suspendedId).eligible===false);
 await act({action:'official-activate',competitionId:nextCompetition,expectedRevision:0});
 const np=await propose(nextCompetition,nextFixtures[0]),nr=await proposal(nextCompetition,np.id);
 check(nr.result.input.teams[otherSide].players.some(p=>p.id===suspendedId));
 check(nr.result.players.find(p=>p.id===suspendedId).secondsPlayed===0);
 const source=(await db.query('select policy from private.official_release_gates where category=$1',['men'])).rows[0].policy;
 await rejects(()=>db.query('select create_operations_candidate_v1($1,$2,$3,$4)',[actor.id,journal,'men',JSON.stringify(source)]),/Conflicting validation/);
 await rejects(()=>act({action:'rehearsal-detail',rehearsalId:journal}),/Unknown competitive rehearsal/);
 await rejects(()=>act({action:'official-proposal',competitionId:nextCompetition,proposalId:p.id}),/no rehearsal fixture/);
 await accept(nextCompetition,np.id);next=await detail(nextCompetition);check(next.suspensions[0].remaining===1);check(next.records.every(r=>r.played===1));check((await detail(firstCompetition)).records.every(r=>r.played===1));
 await dismiss(nextCompetition);
 const third=await propose(nextCompetition,nextFixtures[1]);await accept(nextCompetition,third.id);await dismiss(nextCompetition);
 next=await detail(nextCompetition);check(next.suspensions.length===0&&next.records.every(r=>r.played===2));
 const records=(await db.query('select played from competition_team_records where competition_id=$1',[nextCompetition])).rows;check(records.every(r=>r.played===2));
 const acceptedFirst=(await detail(firstCompetition)).fixtures[0].acceptedId;
 await operate(firstCompetition,{type:'correct',resultId:acceptedFirst,kind:'administrative',reason:'Disposable validation: remove source effects and require cross-competition review'});
 next=await detail(nextCompetition);check(next.reviews.length>=2&&next.suspensions.length===0);
 check((await db.query('select played from competition_team_records where competition_id=$1',[firstCompetition])).rows.every(r=>r.played===0));
 equal((await proposal(firstCompetition,p.id)).result,raw.result);
 const newFixture=randomUUID(),replace={action:'official-replace',competitionId:firstCompetition,fixtureId:firstFixture,newFixtureId:newFixture,expectedRevision:(await detail(firstCompetition)).revision,reason:'Recorded historical replacement using canonical original-month snapshots'};
 check((await act(replace)).added);check(!(await act(replace)).added);
 const rp=await propose(firstCompetition,newFixture),rr=await proposal(firstCompetition,rp.id);equal(rr.result.seed,raw.result.seed);await accept(firstCompetition,rp.id);
 await dismiss(firstCompetition);
 for(const review of (await detail(nextCompetition)).reviews)await operate(nextCompetition,{type:'resolve-review',reviewId:review.id,reason:'Validation commissioner reviewed and upheld the later accepted result'});
 const briefing=await act({action:'official-briefing',competitionId:firstCompetition,roundId:'Round 1'});check(briefing.classification==='competitive'&&briefing.acceptedMatches===1&&briefing.pendingFixtures===0&&briefing.matches[0].id===newFixture);
 check(briefing.playerTotals.reduce((s,p)=>s+(p.stats.points??0),0)===briefing.matches[0].scores.reduce((a,b)=>a+b));
 await operate(firstCompetition,{type:'close',reason:'All current official validation fixtures and reviews complete'});check((await detail(firstCompetition)).status==='closed');
 await rejects(async()=>operate(firstCompetition,{type:'correct',resultId:(await detail(firstCompetition)).fixtures.find(f=>f.id===newFixture).acceptedId,kind:'technical',reason:'Closed source requires an explicit commissioner reopening'}),/reopening/);
 await operate(firstCompetition,{type:'reopen',reason:'Explicitly reopen the disposable official validation competition'});check((await detail(firstCompetition)).status==='active');
 check((await act({action:'official-verify',competitionId:firstCompetition,proposalId:rp.id})).replay.equivalent);
 await db.exec('reset role; set role authenticated');
 await rejects(()=>db.query('select official_readiness_v1($1)',[actor.id]),/permission denied/);
 await rejects(()=>db.query('select * from private.official_release_gates'),/permission denied/);
 await rejects(()=>db.query('insert into official_result_dispositions(fixture_id,stream_id,accepted_event_id) values($1,$2,$3)',[newFixture,journal,randomUUID()]),/permission denied/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor.id]);
 check((await db.query('select played from competition_team_records where competition_id=$1',[firstCompetition])).rows.every(r=>r.played===1));
 await db.exec('reset role; set role service_role');
 await rejects(()=>db.query("update private.official_fixture_inputs set match_input='{}' where fixture_id=$1",[firstFixture]),/permission denied|immutable/);
 await rejects(()=>db.query('update private.official_release_gates set stream_id=null where category=$1',['men']),/cannot be reset/);
 await rejects(()=>db.query('update official_result_dispositions set voided_by=null where fixture_id=$1',[firstFixture]),/cannot be rewritten/);
 const womenSeason=randomUUID();await db.exec('reset role');await db.query("insert into seasons values($1,'setup','women','2026-11-01')",[womenSeason]);await db.exec('set role service_role');
 await rejects(()=>act({...definition,competitionId:randomUUID(),seasonId:womenSeason}),/Official competition disabled/);
 check((await act({action:'official-readiness'})).find(g=>g.category==='women').hasJournal===false);
 if(url){
  const connections=[new pg.Client({connectionString:url}),new pg.Client({connectionString:url})];
  try{
   await Promise.all(connections.map(async c=>{await c.connect();await c.query('set role service_role');}));
   const rev=(await detail(firstCompetition)).revision;
   const outcomes=await Promise.allSettled(connections.map((c,i)=>act({action:'official-command',competitionId:i?nextCompetition:firstCompetition,expectedRevision:rev,commandId:randomUUID(),operation:{type:'close',reason:'Race official competitions sharing a category journal revision'}},rpcOn(c))));
   check(outcomes.filter(r=>r.status==='fulfilled').length===1);check(outcomes.filter(r=>r.status==='rejected').length===1);
   check((await detail(firstCompetition)).revision===rev+1);
  }finally{await Promise.all(connections.map(c=>c.end()));}
 }
 console.log(JSON.stringify({status:'passed',checks,database:url?'isolated PostgreSQL':'isolated PostgreSQL/WASM',sharedCategoryJournal:true,monthAndTransferCarryover:true,atomicRegistrationRollback:true,concurrentSessionsTested:Boolean(url),liveWrites:0}));
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close();}
