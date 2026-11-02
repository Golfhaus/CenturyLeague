import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import pg from 'pg';
import {input as sample} from './replay-runtime-probe.mjs';
import {handleMatchAction} from '../supabase/functions/manage-matches/service.ts';
const url=process.env.COMPETITION_TEST_DATABASE_URL;
if(url&&!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Disposable localhost database required');
const client=url?new pg.Client({connectionString:url}):null;if(client)await client.connect();
const db=client?{query:(q,p)=>client.query(q,p),exec:q=>client.query(q),close:()=>client.end()}:new PGlite();
let checks=0;const check=x=>{assert.ok(x);checks++;};const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};const rejects=async(f,re)=>{await assert.rejects(f,re);checks++;};
const actor={id:randomUUID(),role:'commissioner'},viewer={id:randomUUID(),role:'viewer'};
const stream='10000000-0000-4000-8000-000000000001',season=randomUUID();
const fixtureIds=['20000000-0000-4000-8000-000000000012',randomUUID(),randomUUID()];
const rpcOn=connection=>({rpc:async(name,args)=>{
 try{const keys=Object.keys(args);const vals=keys.map(k=>typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);
  const data=(await connection.query(`select public.${name}(${keys.map((k,i)=>k+'=>$'+(i+1)).join(',')}) receipt`,vals)).rows[0].receipt;return {data,error:null};
 }catch(e){return {data:null,error:{message:e.message,code:e.code}};}
},from(){throw Error('Rehearsal service must use its backend-only RPCs');}});
const adapter=rpcOn(db),act=(body,other=adapter)=>handleMatchAction(other,actor,body);
const detail=()=>act({action:'rehearsal-detail',rehearsalId:stream});
const propose=id=>act({action:'rehearsal-simulate',rehearsalId:stream,fixtureId:id,result:{scores:[100,0]},config:{injuryChancePerContest:1}});
const proposal=id=>act({action:'rehearsal-proposal',rehearsalId:stream,proposalId:id});
const operate=async operation=>act({action:'rehearsal-command',rehearsalId:stream,commandId:randomUUID(),expectedRevision:(await detail()).revision,operation,competitionComplete:true});
const dismissPending=async()=>{for(const c of (await detail()).incidents)await operate({type:'discipline',caseId:c.id,matches:0,reason:'Validation review: no named offense established by the recorded flag'});};
const accept=async(id,other=adapter)=>act({action:'rehearsal-accept',rehearsalId:stream,proposalId:id,commandId:randomUUID(),expectedRevision:(await detail()).revision,result:{scores:[0,0]}},other);
const counts=async()=>(await db.query(`select jsonb_build_object('revision',s.revision,'events',(select count(*) from private.competition_operation_events_candidate e where e.stream_id=s.id),
 'registrations',(select count(*) from private.competitive_rehearsal_results r where r.stream_id=s.id),'head',s.head_sha256) snapshot from private.competition_operation_streams_candidate s where id=$1`,[stream])).rows[0].snapshot;
try{
 if(!(await db.query("select to_regclass('public.competitions') t")).rows[0].t){
  await db.exec(fs.readFileSync('supabase/tests/competition-bootstrap.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261101185535_competition_result_acceptance.sql','utf8'));
 }
 if(!(await db.query("select to_regclass('private.competition_operation_streams_candidate') t")).rows[0].t)await db.exec(fs.readFileSync('supabase/migrations/20261102013314_competition_operations_candidate.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261102022215_integrate_competitive_rehearsals.sql','utf8'));
 await db.query('insert into app_users values($1,$3),($2,$4)',[actor.id,viewer.id,'commissioner','viewer']);
 await db.query("insert into seasons values($1,'setup','men','2026-11-01')",[season]);
 const teams=structuredClone(sample.teams);for(const t of teams){t.id=randomUUID();await db.query("insert into teams values($1,$2,'men')",[t.id,t.name]);await db.query('insert into team_season_rosters values($1,$2,$3,$4)',[randomUUID(),season,t.id,JSON.stringify(t)]);}
 await db.exec('set role service_role');
 for(const action of ['rehearsal-list','rehearsal-create','rehearsal-detail','rehearsal-simulate','rehearsal-accept','rehearsal-command','rehearsal-replace','rehearsal-briefing'])await rejects(()=>handleMatchAction(adapter,viewer,{action}),/Commissioner/);
 const create={action:'rehearsal-create',rehearsalId:stream,name:'Integrated validation',fixtures:fixtureIds.map((id,i)=>({id,seasonId:season,roundId:'Round '+(i+1),matchDate:['2026-11-01','2026-11-03','2026-11-07'][i],teamIds:teams.map(t=>t.id)})),classification:'competitive',policy:{bands:'forged'},teams:[{ratings:'forged'}]};
 check((await act(create)).added);check(!(await act(create)).added);
 let d=await detail();check(d.fixtures.length===3&&d.records.every(r=>r.played===0));
 check(d.policy.id==='recovery-calendar-v1');
 equal(d.policy.bands,[{weight:80,minimumDays:1,maximumDays:4},{weight:18,minimumDays:5,maximumDays:10},{weight:2,minimumDays:11,maximumDays:28}]);
 await rejects(()=>operate({type:'close',reason:'Try to close an unfinished fixture list'}),/Resolve|Pending/);
 const first=await propose(fixtureIds[0]),second=await propose(fixtureIds[1]),third=await propose(fixtureIds[2]);
 const original=await proposal(first.id);check(original.result.players.length===70&&original.result.config.injuryChancePerContest===0.0008);
 check(original.result.input.teams[0].players[0].ratings.speed===teams[0].players[0].ratings.speed);
 check(original.result.events.some(e=>e.type==='injury'));check(original.result.events.some(e=>e.type==='foul'&&e.data.serious));
 equal((await detail()).records.map(r=>r.played),[0,0]);
 const raw=(await db.query('select * from private.competitive_rehearsal_inputs where fixture_id=$1',[fixtureIds[0]])).rows[0];
 equal(raw.match_input,original.result.input);check(raw.input_sha256.length===64);
 const noReroll=await propose(fixtureIds[0]);check(noReroll.id===first.id&&!noReroll.added);
 // Force registration insertion to fail after the journal event insert begins.
 await db.exec('reset role');
 await db.exec(`create function private.rehearsal_injected_failure() returns trigger language plpgsql as $$ begin raise exception 'Injected registration failure'; end $$;
 create trigger injected_registration_failure before insert on private.competitive_rehearsal_results for each row execute function private.rehearsal_injected_failure()`);
 await db.exec('set role service_role');const before=await counts();
 await rejects(()=>accept(first.id),/Injected registration failure/);equal(await counts(),before);
 await db.exec('reset role');await db.exec('drop trigger injected_registration_failure on private.competitive_rehearsal_results; drop function private.rehearsal_injected_failure()');await db.exec('set role service_role');
 const lostReply={...adapter,rpc:async(name,args)=>{const r=await adapter.rpc(name,args);if(name==='append_operation_candidate_v1'&&!r.error)throw Error('Injected lost successful reply');return r;}};
 await rejects(()=>accept(first.id,lostReply),/lost successful reply/);
 check((await counts()).registrations===1);check((await detail()).injuries.length>0);
 check(!(await accept(first.id)).added);check((await counts()).registrations===1);
 d=await detail();const incident=d.incidents.find(c=>!d.injuries.some(i=>i.name===c.name));check(Boolean(incident));
 equal(d.fixtures.find(f=>f.id===fixtureIds[0]).eligibleCounts,[35,35]); // Historical eligibility is its actual pinned snapshot.
 await operate({type:'discipline',caseId:incident.id,matches:2,reason:'Validation only: exercise a two-match commissioner sanction, not a league tariff'});
 await dismissPending();d=await detail();check(d.suspensions[0].remaining===2);
 check(d.fixtures.find(f=>f.id===fixtureIds[1]).eligibilityChanged);
 await rejects(()=>accept(second.id),/Eligibility changed/);
 const replacementId=randomUUID(),replace={action:'rehearsal-replace',rehearsalId:stream,fixtureId:fixtureIds[1],newFixtureId:replacementId,expectedRevision:d.revision,reason:'Explicitly repin availability after the previous accepted match'};
 check((await act(replace)).added);check(!(await act(replace)).added);
 await rejects(()=>act({...replace,teamIds:[teams[1].id,teams[0].id]}),/already replaced/);
 await rejects(()=>accept(second.id),/superseded/);
 const updated=await propose(replacementId),updatedResult=await proposal(updated.id);
 check(updatedResult.result.seed===original.result.input.provenance.competitionId+':'+fixtureIds[1]);
 const absent=updatedResult.result.input.availability.players.filter(p=>!p.eligible);check(absent.length>0);
 check(absent.every(p=>updatedResult.result.players.find(r=>r.id===p.playerId).secondsPlayed===0));
 await accept(updated.id);check((await detail()).suspensions[0].remaining===1);
 const activeSecond=(await detail()).fixtures.find(f=>f.id===replacementId);
 const acceptedFirst=(await detail()).fixtures.find(f=>f.id===fixtureIds[0]);
 await operate({type:'correct',resultId:acceptedFirst.acceptedId,kind:'administrative',reason:'Validation correction: preserve the original and exercise downstream review'});
 d=await detail();check(d.reviews.some(r=>r.resultId===activeSecond.acceptedId));check(d.records.every(r=>r.played===1));
 equal((await proposal(first.id)).result,original.result);
 const correctedId=randomUUID();await act({action:'rehearsal-replace',rehearsalId:stream,fixtureId:fixtureIds[0],newFixtureId:correctedId,expectedRevision:d.revision,reason:'Prepare recorded historical replacement with canonical rosters'});
 const corrected=await propose(correctedId);await accept(corrected.id);
 check((await detail()).records.every(r=>r.played===2));
 await dismissPending();for(const r of (await detail()).reviews)await operate({type:'resolve-review',reviewId:r.id,reason:'Commissioner reviewed the affected fixture and upheld the recorded result'});
 // Third proposal was pinned before the ban; after void/dismissal it is either
 // still valid or explicitly repinned, never silently overwritten.
 d=await detail();let finalProposal=third;
 if(d.fixtures.find(f=>f.id===fixtureIds[2]).eligibilityChanged){const newId=randomUUID();await act({action:'rehearsal-replace',rehearsalId:stream,fixtureId:fixtureIds[2],newFixtureId:newId,expectedRevision:d.revision,reason:'Explicitly repin final fixture after reviewed availability corrections'});finalProposal=await propose(newId);}
 await accept(finalProposal.id);await dismissPending();d=await detail();check(d.records.every(r=>r.played===3));
 const briefing=await act({action:'rehearsal-briefing',rehearsalId:stream,roundId:'Round 1'});
 check(briefing.acceptedMatches===1&&briefing.pendingFixtures===0&&briefing.matches[0].id===correctedId);
 check(briefing.playerTotals.reduce((s,p)=>s+(p.stats.points??0),0)===briefing.matches[0].scores.reduce((a,b)=>a+b));
 await operate({type:'close',reason:'All explicit rehearsal fixtures and required reviews completed'});
 check((await detail()).status==='closed');
 await rejects(()=>operate({type:'correct',resultId:(d.fixtures.find(f=>f.id===correctedId)).acceptedId,kind:'technical',reason:'Attempt correction after closure must require reopening'}),/reopening/);
 await operate({type:'reopen',reason:'Explicitly reopen the validation rehearsal for commissioner inspection'});check((await detail()).status==='active');
 const verified=await act({action:'rehearsal-verify',rehearsalId:stream,proposalId:corrected.id});check(verified.replay.equivalent);
 await db.exec('reset role; set role authenticated');
 await rejects(()=>db.query('select public.read_competitive_rehearsal_v1($1,$2)',[actor.id,stream]),/permission denied/);
 await rejects(()=>db.query('select * from private.competitive_rehearsal_results'),/permission denied/);
 await db.exec('reset role; set role service_role');
 await rejects(()=>db.query('update private.competitive_rehearsal_inputs set match_input=$1 where fixture_id=$2',[JSON.stringify({}),fixtureIds[0]]),/permission denied|immutable/);
 check((await db.query("select count(*)::integer n from competitions where classification='competitive'")).rows[0].n===0);
 if(url){
  const connections=[new pg.Client({connectionString:url}),new pg.Client({connectionString:url})];
  try{
   await Promise.all(connections.map(async c=>{await c.connect();await c.query('set role service_role');}));
   d=await detail();const commands=connections.map(()=>({action:'rehearsal-command',rehearsalId:stream,commandId:randomUUID(),expectedRevision:d.revision,operation:{type:'close',reason:'Race two commissioner closure requests against the same revision'}}));
   const results=await Promise.allSettled(connections.map((c,i)=>act(commands[i],rpcOn(c))));
   check(results.filter(r=>r.status==='fulfilled').length===1);check(results.filter(r=>r.status==='rejected').length===1);
   check((await detail()).revision===d.revision+1);
  }finally{await Promise.all(connections.map(c=>c.end()));}
 }
 console.log(JSON.stringify({checks,status:'passed',database:url?'isolated PostgreSQL server':'isolated PostgreSQL/WASM',concurrentSessionsTested:Boolean(url),atomicRegistrationFailureTested:true,lostReplyRecoveryTested:true,officialResultsCreated:0,liveDatabaseWrites:0}));
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close();}
