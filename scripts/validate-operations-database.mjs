import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { input as fictionalInput } from './replay-runtime-probe.mjs';
import { prepareCompetitiveInput, simulateCompetitiveMatch, operationsView, executeOperation } from '../packages/simulation-core/dist/competitive/index.js';
import { readOperationsCandidate,commitOperationCandidate } from './lib/operations-database.mjs';
const databaseURL=process.env.COMPETITION_TEST_DATABASE_URL;
if(databaseURL&&!['localhost','127.0.0.1'].includes(new URL(databaseURL).hostname))throw Error('Use only a disposable localhost test database');
const client=databaseURL?new pg.Client({connectionString:databaseURL}):null;
if(client)await client.connect();
const db=client?{exec:s=>client.query(s),query:(s,p)=>client.query(s,p),close:()=>client.end()}:new PGlite();
let checks=0;const check=x=>{assert.ok(x);checks++;};const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
const rejects=async(f,p)=>{await assert.rejects(f,p);checks++;};
const actor={id:randomUUID(),role:'commissioner'},viewer=randomUUID(),stream=randomUUID();
const policy={id:'fixed-two-days-database-test',bands:[{weight:1,minimumDays:2,maximumDays:2}]};
const zero='0'.repeat(64),at='2026-11-01T12:00:00Z';
try {
 const existing=(await db.query("select to_regclass('public.competitions') t")).rows[0].t;
 if(!existing){
  await db.exec(fs.readFileSync('supabase/tests/competition-bootstrap.sql','utf8'));
  const common=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_competition_result_acceptance.sql'));
  await db.exec(fs.readFileSync('supabase/migrations/'+common,'utf8'));
 }
 await db.exec(fs.readFileSync('supabase/migrations/20261102013314_competition_operations_candidate.sql','utf8'));
 await db.query('insert into app_users values($1,$3),($2,$4)',[actor.id,viewer,'commissioner','viewer']);
 await db.exec('set role service_role');
 const init=async(id=stream,who=actor.id,category='men')=>(await db.query('select public.create_operations_candidate_v1($1,$2,$3,$4) receipt',[who,id,category,JSON.stringify(policy)])).rows[0].receipt;
 check((await init()).purpose==='validation');equal(await init(),await init());
 await rejects(()=>init(stream,actor.id,'women'),/Conflicting/);
 await rejects(()=>init(randomUUID(),viewer),/Commissioner/);
 let saved=await readOperationsCandidate(db,stream,actor);equal(saved.state.events,[]);check(saved.headSHA256===zero);
 const fixture={...structuredClone(fictionalInput),id:randomUUID(),seed:'availability-2',config:{injuryChancePerContest:0.004},
  provenance:{classification:'competitive',competitionId:'database-validation-comp',competitionCategory:'men'}};
 const result=simulateCompetitiveMatch(prepareCompetitiveInput(saved.state,fixture,'2026-10-31'));
 const sourceProposalId=randomUUID();
 const saveProposal=async(id,payload)=>(await db.query('select public.stage_operations_proposal_candidate_v1($1,$2,$3,$4) receipt',
  [actor.id,stream,id,JSON.stringify(payload)])).rows[0].receipt;
 const sourceProposal=await saveProposal(sourceProposalId,result);
 check(sourceProposal.added);check(!(await saveProposal(sourceProposalId,result)).added);
 await rejects(()=>saveProposal(sourceProposalId,{...result,scores:[99,99]}),/Conflicting/);
 const accepted={id:randomUUID(),expectedRevision:0,at,operation:{type:'accept',proposalId:randomUUID(),
  resultSHA256:sourceProposal.sha256,competitionId:'database-validation-comp',matchDate:'2026-10-31'}};
 accepted.operation.proposalId=sourceProposalId;
 const staged=executeOperation(saved.state,accepted,actor,{result});
 const before=await readOperationsCandidate(db,stream,actor);
 // A generated proposal alone has no durable availability effects.
 check(operationsView(before.state).injuries.length===0&&before.state.revision===0);
 await rejects(()=>commitOperationCandidate(db,stream,{...accepted,operation:{...accepted.operation,resultSHA256:'f'.repeat(64)}},actor),/digest mismatch/);
 // Even a forged result supplied as context is ignored; acceptance loads the immutable saved proposal.
 const receipt=await commitOperationCandidate(db,stream,accepted,actor,{result:{scores:[0,0]}});check(receipt.added&&receipt.revision===1);
 check(!(await commitOperationCandidate(db,stream,accepted,actor,{result})).added);
 saved=await readOperationsCandidate(db,stream,actor);
 equal(saved.state,staged.state);
 const source=operationsView(saved.state).active[0];check(source.injuries.length===1&&source.discipline.length===1);
 equal(source.injuries[0].recoveredOn,'2026-11-02');
 const incident=source.discipline[0];
 const decision={id:randomUUID(),expectedRevision:1,at,operation:{type:'discipline',caseId:incident.id,matches:2,reason:'Commissioner reviewed the saved serious incident evidence'}};
 check((await commitOperationCandidate(db,stream,decision,actor)).added);
 const fresh={query:(sql,params)=>db.query(sql,params)};
 saved=await readOperationsCandidate(fresh,stream,actor);
 check(saved.state.revision===2&&operationsView(saved.state).suspensions[0].matches===2);
 const nextBase={...structuredClone(fixture),id:randomUUID(),seed:'availability-next',config:{injuryChancePerContest:0}};
 nextBase.teams[0].id='transferred-club';
 const pinned=prepareCompetitiveInput(saved.state,nextBase,'2026-11-01');
 check(!pinned.availability.players.find(p=>p.playerId===incident.playerId).eligible);
 const nextResult=simulateCompetitiveMatch(pinned);
 const nextProposalId=randomUUID(),nextProposal=await saveProposal(nextProposalId,nextResult);
 const nextCommand={id:randomUUID(),expectedRevision:2,at,operation:{type:'accept',proposalId:randomUUID(),
  resultSHA256:nextProposal.sha256,competitionId:'database-validation-comp',matchDate:'2026-11-01'}};
 nextCommand.operation.proposalId=nextProposalId;
 check((await commitOperationCandidate(db,stream,nextCommand,actor,{result:nextResult})).added);
 saved=await readOperationsCandidate(db,stream,actor);
 equal(operationsView(saved.state).suspensions[0].servedBy,[nextCommand.id]);
 const retryRaw=async(event,revision=0,head=zero)=>(await db.query('select public.append_operation_candidate_v1($1,$2,$3,$4,$5) receipt',
  [actor.id,stream,revision,head,JSON.stringify(event)])).rows[0].receipt;
 check(!(await retryRaw(staged.event)).added); // Original revision retry after several later commits.
 await rejects(()=>retryRaw({...staged.event,request:'changed'}),/Conflicting/);
 const attemptCommand=(revision,id=randomUUID())=>({id,expectedRevision:revision,at,operation:{type:'attempt',evidence:{fixtureId:randomUUID(),
  inputSHA256:'a'.repeat(64),seed:'pinned-restart-seed',engineVersion:result.engineVersion,outcome:'aborted',code:'transport_failure'}}});
 const trial=attemptCommand(saved.state.revision),trialEvent=executeOperation(saved.state,trial,actor).event;
 await rejects(()=>retryRaw(trialEvent,saved.state.revision,'f'.repeat(64)),/Stale/);
 await rejects(()=>db.query('update private.competition_operation_events_candidate set payload=$1 where stream_id=$2',[JSON.stringify({}),stream]),/permission denied|immutable/);
 await rejects(()=>db.query('delete from private.competition_operation_events_candidate where stream_id=$1',[stream]),/permission denied|immutable/);
 await rejects(()=>db.query('update private.competition_operation_proposals_candidate set result=$1 where stream_id=$2',[JSON.stringify({}),stream]),/permission denied|immutable/);
 await rejects(()=>db.query("update private.competition_operation_streams_candidate set policy='{}' where id=$1",[stream]),/immutable/);
 // Transaction rollback must release both the appended event and the stream head.
 await db.exec('begin');await retryRaw(trialEvent,saved.state.revision,saved.headSHA256);await db.exec('rollback');
 equal(await readOperationsCandidate(db,stream,actor),saved);
 // Integrity reads fail closed on a damaged head, and rollback restores it.
 await db.exec('begin');await db.query('update private.competition_operation_streams_candidate set head_sha256=$1 where id=$2',['f'.repeat(64),stream]);
 await rejects(()=>readOperationsCandidate(db,stream,actor),/integrity failure/);await db.exec('rollback');
 equal(await readOperationsCandidate(db,stream,actor),saved);
 // A void changes projections while preserving both source events and downstream results.
 const correction={id:randomUUID(),expectedRevision:saved.state.revision,at,operation:{type:'correct',resultId:source.id,
  kind:'administrative',reason:'Documented eligibility input error requires commissioner correction'}};
 check((await commitOperationCandidate(db,stream,correction,actor)).added);
 saved=await readOperationsCandidate(db,stream,actor);
 const corrected=operationsView(saved.state);check(corrected.active.length===1&&corrected.results.length===2);
 check(corrected.injuries.length===0&&corrected.suspensions.length===0);
 check(corrected.reviews.some(r=>r.resultId===nextCommand.id&&!r.resolvedBy));
 equal(saved.state.events[0],staged.event);
 const preserved=(await db.query('select public.read_operations_proposal_candidate_v1($1,$2,$3) receipt',[actor.id,stream,sourceProposalId])).rows[0].receipt;
 equal(preserved.result,JSON.parse(JSON.stringify(result)));check(preserved.sha256===sourceProposal.sha256);
 await db.exec('reset role; set role authenticated');
 await rejects(()=>db.query('select public.read_operations_candidate_v1($1,$2)',[actor.id,stream]),/permission denied/);
 await rejects(()=>db.query('select public.append_operation_candidate_v1($1,$2,$3,$4,$5)',[actor.id,stream,0,zero,JSON.stringify(staged.event)]),/permission denied/);
 await rejects(()=>db.query('select * from private.competition_operation_events_candidate'),/permission denied/);
 await rejects(()=>db.query('select public.stage_operations_proposal_candidate_v1($1,$2,$3,$4)',[actor.id,stream,randomUUID(),JSON.stringify(result)]),/permission denied/);
 await db.exec('reset role; set role anon');
 await rejects(()=>db.query('select public.create_operations_candidate_v1($1,$2,$3,$4)',[actor.id,randomUUID(),'men',JSON.stringify(policy)]),/permission denied/);
 await db.exec('reset role; set role service_role');
 if(databaseURL){
  const clients=[new pg.Client({connectionString:databaseURL}),new pg.Client({connectionString:databaseURL})];
  try {
   await Promise.all(clients.map(async c=>{await c.connect();await c.query('set role service_role');}));
   const latest=await readOperationsCandidate(db,stream,actor);
   const commands=[attemptCommand(latest.state.revision),attemptCommand(latest.state.revision)];
   const events=commands.map(c=>executeOperation(latest.state,c,actor).event);
   const racing=await Promise.allSettled(clients.map((c,i)=>c.query('select public.append_operation_candidate_v1($1,$2,$3,$4,$5) receipt',
    [actor.id,stream,latest.state.revision,latest.headSHA256,JSON.stringify(events[i])])));
   check(racing.filter(r=>r.status==='fulfilled').length===1);
   check(racing.filter(r=>r.status==='rejected'&&r.reason.code==='40001').length===1);
   const lost=racing.findIndex(r=>r.status==='rejected');
   const refreshed=await readOperationsCandidate(db,stream,actor);
   check((await commitOperationCandidate(db,stream,{...commands[lost],expectedRevision:refreshed.state.revision},actor)).added);
   check(!(await commitOperationCandidate(db,stream,{...commands[lost],expectedRevision:refreshed.state.revision},actor)).added);
  }finally{await Promise.all(clients.map(c=>c.end()));}
 }
 console.log(JSON.stringify({checks,status:'passed',database:databaseURL?'isolated PostgreSQL server':'isolated PostgreSQL/WASM',
  concurrentSessionsTested:Boolean(databaseURL),officialWrites:0,liveDatabaseWrites:0}));
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close();}
