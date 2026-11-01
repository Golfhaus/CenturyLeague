import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { ATTRIBUTE_KEYS } from '../packages/simulation-core/dist/types.js';
import { TACTIC_KEYS } from '../packages/simulation-core/dist/match/types.js';
import { handleMatchAction } from '../supabase/functions/manage-matches/service.ts';
import { createCompetition, activateCompetition, simulateCompetitionFixture, validateCompetitionFixtureResult, COMPETITION_ENGINE_SOURCE_SHA256 } from '../packages/simulation-core/dist/competition/index.js';
const databaseURL=process.env.COMPETITION_TEST_DATABASE_URL;
if(databaseURL&&!['localhost','127.0.0.1'].includes(new URL(databaseURL).hostname))throw Error('Use only an empty disposable localhost test database');
const client=databaseURL?new pg.Client({connectionString:databaseURL}):null;
if(client)await client.connect();
const db=client?{exec:s=>client.query(s),query:(s,p)=>client.query(s,p),close:()=>client.end()}:new PGlite(); let checks=0;
const check=(x)=>{assert.ok(x);checks++;};
const checkEqual=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const rejects=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++;};
const query=(s,p)=>db.query(s,p);
const rpc=async(name,args)=>{const vals=Object.values(args); return (await query(`select public.${name}(${vals.map((_,i)=>'$'+(i+1)).join(',')}) as receipt`,vals)).rows[0].receipt;};
try {
await db.exec(fs.readFileSync('supabase/tests/competition-bootstrap.sql','utf8'));
const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_competition_result_acceptance.sql'));
await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
const commissioner=randomUUID(),viewer=randomUUID(),season=randomUUID(),womenSeason=randomUUID();
await query('insert into app_users values($1,$3),($2,$4)',[commissioner,viewer,'commissioner','viewer']);
await query("insert into seasons values($1,'setup','men','2026-11-01'),($2,'setup','women','2026-11-01')",[season,womenSeason]);
const teams=Array.from({length:4},(_,i)=>({id:randomUUID(),name:`Test club ${i+1}`,coach:{name:`Test coach ${i+1}`,tactics:Object.fromEntries(TACTIC_KEYS.map(k=>[k,3]))},players:Array.from({length:35},(_,j)=>({id:randomUUID(),name:`Player ${i}-${j}`,ratings:Object.fromEntries(ATTRIBUTE_KEYS.map(k=>[k,11]))}))}));
for(const t of teams){await query("insert into teams values($1,$2,'men')",[t.id,t.name]);await query('insert into team_season_rosters values($1,$2,$3,$4)',[randomUUID(),season,t.id,JSON.stringify(t)]);}
const d={id:randomUUID(),name:'Disposable acceptance check',seasonKey:'2026-11',category:'men',classification:'exhibition',engineVersion:'0.1.0-exhibition',engineSourceSHA256:COMPETITION_ENGINE_SOURCE_SHA256,teams,fixtures:[{id:randomUUID(),roundId:'round-1',seed:'db-1',teamIds:[teams[0].id,teams[1].id]},{id:randomUUID(),roundId:'round-1',seed:'db-2',teamIds:[teams[2].id,teams[3].id]}]};
createCompetition(d);
await db.exec('set role service_role');
const create=def=>rpc('create_exhibition_competition_v1',{actor:commissioner,season,definition:JSON.stringify(def)});
check((await create(d)).added);
check(!(await create(d)).added);
await rejects(()=>create({...d,name:'Changed'}),/Conflicting/);
await rejects(()=>rpc('create_exhibition_competition_v1',{actor:viewer,season,definition:JSON.stringify({...d,id:randomUUID()})}),/Commissioner/);
await rejects(()=>create({...d,id:randomUUID(),classification:'competitive'}),/deferred/);
await rejects(()=>create({...d,id:randomUUID(),category:'women'}),/scope/);
const changed=structuredClone(d);changed.id=randomUUID();changed.teams[0].players[0].ratings.speed=12;
await rejects(()=>create(changed),/canonical/);
check((await query('select count(*)::integer n from competitions')).rows[0].n===1);
const activate=revision=>rpc('activate_competition_v1',{actor:commissioner,id:d.id,revision});
await rejects(()=>activate(9),/Stale/);
check((await activate(0)).added);check(!(await activate(0)).added);
const state=activateCompetition(createCompetition(d),0);
const first=simulateCompetitionFixture(state,d.fixtures[0].id),second=simulateCompetitionFixture(state,d.fixtures[1].id);
validateCompetitionFixtureResult(d,first);checks++;
const stage=result=>rpc('stage_match_proposal_v1',{actor:commissioner,fixture:result.id,result:JSON.stringify(result)});
const changedResult=structuredClone(first);changedResult.input.teams[0].players[0].ratings.speed=12;
await rejects(()=>stage(changedResult),/pinned/);
const proposal=await stage(first);check(proposal.added);check(!(await stage(first)).added);
await rejects(()=>stage({...first,scores:[99,99]}),/Conflicting/);
check((await query('select sum(played)::integer n from competition_team_records')).rows[0].n===0);
const accept=(id,revision,actor=commissioner)=>rpc('accept_match_proposal_v1',{actor,id,revision});
await rejects(()=>accept(proposal.id,1,viewer),/Commissioner/);
await rejects(()=>accept(proposal.id,0),/Stale/);
check((await accept(proposal.id,1)).added);
check(!(await accept(proposal.id,1)).added);
const proposal2=await stage(second);
await rejects(()=>accept(proposal2.id,1),/Stale/);
check((await accept(proposal2.id,2)).status==='complete');
check(!(await accept(proposal2.id,0)).added);
const records=(await query('select * from competition_team_records order by name')).rows;
check(records.length===4&&records.every(r=>r.played===1));
check(records.reduce((s,r)=>s+r.wins,0)===2&&records.reduce((s,r)=>s+r.losses,0)===2);
check(records.reduce((s,r)=>s+r.points_for,0)===first.scores.reduce((a,b)=>a+b)+second.scores.reduce((a,b)=>a+b));
check((await query("select count(*)::integer n from competition_audit where action='accepted'")).rows[0].n===2);
await rejects(()=>query("update match_proposals set result='{}' where id=$1",[proposal.id]),/immutable/);
await rejects(()=>query('delete from match_results'),/permission denied/);
await rejects(()=>query("update competitions set definition='{}' where id=$1",[d.id]),/immutable/);
await db.exec('reset role; set role authenticated');
await query("select set_config('request.jwt.claim.sub',$1,false)",[viewer]);
check((await query('select count(*)::integer n from competitions')).rows[0].n===1);
await rejects(()=>activate(3),/permission denied/);
await rejects(()=>accept(proposal.id,3),/permission denied/);
await rejects(()=>query("update competitions set status='draft'"),/permission denied/);
await query("select set_config('request.jwt.claim.sub',$1,false)",[randomUUID()]);
check((await query('select count(*)::integer n from competitions')).rows[0].n===0);
await db.exec('reset role; set role anon');
await rejects(()=>query('select * from match_proposals'),/permission denied/);
await rejects(()=>accept(proposal.id,3),/permission denied/);
await db.exec('reset role; set role service_role');
// Run the actual Edge service against PostgreSQL through a small PostgREST-shaped adapter.
let reads=0;
const adapter={
 rpc:async(name,args)=>{try{return {data:await rpc(name,Object.fromEntries(Object.entries(args).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):v]))),error:null};}catch(e){return {data:null,error:{message:e.message,code:e.code}};}},
 from(table){
  let columns='*',filters=[],ordering='',limit='',single=false,optional=false;
  const builder={select(s){columns=s;return this;},eq(k,v){filters.push([k,v]);return this;},order(k,o={}){ordering=` order by ${k} ${o.ascending===false?'desc':'asc'}`;return this;},limit(n){limit=` limit ${n}`;return this;},single(){single=true;return this;},maybeSingle(){single=true;optional=true;return this;},
  async then(resolve,reject){reads++;try{const q=`select ${columns} from public.${table}`+(filters.length?' where '+filters.map(([k],i)=>`${k}=$${i+1}`).join(' and '):'')+ordering+limit;const rows=JSON.parse(JSON.stringify((await query(q,filters.map(([,v])=>v))).rows));if(single&&rows.length!==1&&!optional)throw Error('Record not found');return resolve({data:single?(rows[0]??null):rows,error:null});}catch(e){return resolve({data:null,error:{message:e.message,code:e.code}});}}};return builder;
 }
};
const actor={id:commissioner,role:'commissioner'},readonly={id:viewer,role:'viewer'};
for(const action of ['create-exhibition','activate','simulate','accept'])await rejects(()=>handleMatchAction(adapter,readonly,{action}),/Commissioner/);
await rejects(()=>handleMatchAction(adapter,actor,{action:'bogus'}),/Unknown/);
const serviceId=randomUUID(),serviceFixture=randomUUID();
const createBody={action:'create-exhibition',competitionId:serviceId,seasonId:season,name:'Service rehearsal',fixtures:[{id:serviceFixture,roundId:'one',teamIds:[teams[0].id,teams[1].id]}],classification:'competitive',actor:'forged',teams:[{ratings:'forged'}]};
check((await handleMatchAction(adapter,actor,createBody)).added);
check(!(await handleMatchAction(adapter,actor,createBody)).added);
check((await query('select classification from competitions where id=$1',[serviceId])).rows[0].classification==='exhibition');
await rejects(()=>handleMatchAction(adapter,actor,{action:'simulate',fixtureId:serviceFixture}),/Activate/);
await handleMatchAction(adapter,actor,{action:'activate',competitionId:serviceId,expectedRevision:0});
const generated=await handleMatchAction(adapter,actor,{action:'simulate',fixtureId:serviceFixture,result:{scores:[100,0]},actor:'forged'});
check(generated.added);
check(!(await handleMatchAction(adapter,actor,{action:'simulate',fixtureId:serviceFixture})).added);
const saved=await handleMatchAction(adapter,readonly,{action:'proposal',proposalId:generated.id});
check(saved.result.input.teams[0].players[0].ratings.speed===11);
check(saved.result.seed===`${serviceId}:${serviceFixture}`);
check(saved.result.events.length>0&&saved.result.players.length===70);
check((await handleMatchAction(adapter,readonly,{action:'briefing',competitionId:serviceId,roundId:'one'})).acceptedMatches===0);
const before=reads;
await handleMatchAction(adapter,actor,{action:'accept',proposalId:generated.id,expectedRevision:1,result:{scores:[100,0]}});
check(reads===before); // Acceptance reads and locks the fixture in SQL, not the entire season ledger.
check(!(await handleMatchAction(adapter,actor,{action:'accept',proposalId:generated.id,expectedRevision:1})).added);
const detail=await handleMatchAction(adapter,readonly,{action:'detail',competitionId:serviceId});
check(detail.competition.status==='complete'&&detail.records.every(r=>r.played===1));
check(detail.fixtures[0].teams.every(t=>Object.keys(t).length===2));
check((await handleMatchAction(adapter,readonly,{action:'verify',proposalId:generated.id})).verified);
const brief=await handleMatchAction(adapter,readonly,{action:'briefing',competitionId:serviceId,roundId:'one'});
check(brief.acceptedMatches===1&&brief.pendingFixtures===0&&brief.matches[0].winningPlay.eventId>0);
check((await query('select accepted_by from match_results where fixture_id=$1',[serviceFixture])).rows[0].accepted_by===commissioner);
// Approved technical-abort policy: no invented result, then recover/restart the pinned fixture.
const countsFor=async competitionId=>(await query(`select jsonb_build_object(
 'status',c.status,'revision',c.revision,
 'proposals',(select count(*) from match_proposals p join competition_fixtures f on f.id=p.fixture_id where f.competition_id=c.id),
 'results',(select count(*) from match_results a join competition_fixtures f on f.id=a.fixture_id where f.competition_id=c.id),
 'played',(select coalesce(sum(played),0) from competition_team_records where competition_id=c.id)) snapshot
 from competitions c where c.id=$1`,[competitionId])).rows[0].snapshot;
const emptyActive={status:'active',revision:1,proposals:0,results:0,played:0};
const abortFixture=randomUUID(),abortDefinition={...d,id:randomUUID(),name:'Technical abort guard',config:{maxEvents:100},fixtures:[{...d.fixtures[0],id:abortFixture,seed:'technical-abort-guard'}]};
await create(abortDefinition);
await rpc('activate_competition_v1',{actor:commissioner,id:abortDefinition.id,revision:0});
const abortInput=(await query('select match_input from competition_fixtures where id=$1',[abortFixture])).rows[0].match_input;
for(let attempt=0;attempt<2;attempt++)await rejects(()=>handleMatchAction(adapter,actor,{action:'simulate',fixtureId:abortFixture}),/exceeded safety limit; no result or forced winner recorded/);
checkEqual(await countsFor(abortDefinition.id),emptyActive);
checkEqual((await query('select match_input from competition_fixtures where id=$1',[abortFixture])).rows[0].match_input,abortInput);
const retryFixture=randomUUID(),retryDefinition={...d,id:randomUUID(),name:'Interrupted request recovery',fixtures:[{...d.fixtures[0],id:retryFixture,seed:'interrupted-request-recovery'}]};
await create(retryDefinition);
await rpc('activate_competition_v1',{actor:commissioner,id:retryDefinition.id,revision:0});
let interruptedResult;
const outageBeforeWrite={...adapter,rpc:async(name,args)=>{
 if(name==='stage_match_proposal_v1'){interruptedResult=structuredClone(args.p_result);throw Error('Synthetic outage before proposal write');}
 return adapter.rpc(name,args);
}};
await rejects(()=>handleMatchAction(outageBeforeWrite,actor,{action:'simulate',fixtureId:retryFixture}),/Synthetic outage before proposal write/);
checkEqual(await countsFor(retryDefinition.id),emptyActive);
const lostReply={...adapter,rpc:async(name,args)=>{
 const response=await adapter.rpc(name,args);
 if(!response.error&&['stage_match_proposal_v1','accept_match_proposal_v1'].includes(name))throw Error('Synthetic lost reply after commit');
 return response;
}};
await rejects(()=>handleMatchAction(lostReply,actor,{action:'simulate',fixtureId:retryFixture}),/Synthetic lost reply after commit/);
checkEqual(await countsFor(retryDefinition.id),{...emptyActive,proposals:1});
const recovered=await handleMatchAction(adapter,actor,{action:'simulate',fixtureId:retryFixture});
check(recovered.added===false);
const recoveredRow=(await query('select result from match_proposals where id=$1',[recovered.id])).rows[0];
checkEqual(recoveredRow.result,JSON.parse(JSON.stringify(interruptedResult))); // Same pinned seed/input; no reroll after a failed write.
await rejects(()=>handleMatchAction(lostReply,actor,{action:'accept',proposalId:recovered.id,expectedRevision:1}),/Synthetic lost reply after commit/);
checkEqual(await countsFor(retryDefinition.id),{status:'complete',revision:2,proposals:1,results:1,played:2});
check(!(await handleMatchAction(adapter,actor,{action:'accept',proposalId:recovered.id,expectedRevision:1})).added);
check((await query("select count(*)::integer n from competition_audit where competition_id=$1 and action='accepted'",[retryDefinition.id])).rows[0].n===1);
if(databaseURL){
 // Two real PostgreSQL sessions contend on the same competition row.
 const race={...d,id:randomUUID(),name:'Concurrency rehearsal',fixtures:d.fixtures.map(f=>({...f,id:randomUUID()}))};
 await create(race);
 await rpc('activate_competition_v1',{actor:commissioner,id:race.id,revision:0});
 const raceState=activateCompetition(createCompetition(race),0);
 const raceProposals=[];
 for(const f of race.fixtures)raceProposals.push(await stage(simulateCompetitionFixture(raceState,f.id)));
 const clients=[new pg.Client({connectionString:databaseURL}),new pg.Client({connectionString:databaseURL})];
 try {
  await Promise.all(clients.map(async c=>{await c.connect();await c.query('set role service_role');}));
  const acceptOn=(c,p,rev)=>c.query('select public.accept_match_proposal_v1($1,$2,$3) receipt',[commissioner,p.id,rev]);
  await clients[0].query('begin');await acceptOn(clients[0],raceProposals[0],1);await clients[0].query('rollback');
  check((await query('select revision from competitions where id=$1',[race.id])).rows[0].revision===1);
  const racing=await Promise.allSettled(clients.map((c,i)=>acceptOn(c,raceProposals[i],1)));
  check(racing.filter(r=>r.status==='fulfilled').length===1);
  check(racing.filter(r=>r.status==='rejected'&&r.reason.code==='40001').length===1);
  const lost=racing.findIndex(r=>r.status==='rejected');
  check((await acceptOn(clients[lost],raceProposals[lost],2)).rows[0].receipt.status==='complete');
  const retries=await Promise.all(clients.map((c,i)=>acceptOn(c,raceProposals[i],1)));
  check(retries.every(r=>r.rows[0].receipt.added===false));
  check((await query('select revision from competitions where id=$1',[race.id])).rows[0].revision===3);
  check((await query("select count(*)::integer n from competition_audit where competition_id=$1 and action='accepted'",[race.id])).rows[0].n===2);
 } finally {await Promise.all(clients.map(c=>c.end()));}
}
await db.exec('reset role');
await db.exec('begin');
await query('insert into app_users values($1,$2)',[randomUUID(),'viewer']);
await db.exec('rollback');
check((await query('select count(*)::integer n from app_users')).rows[0].n===2);
console.log(JSON.stringify({checks,status:'passed',database:databaseURL?'isolated PostgreSQL server':'isolated PostgreSQL/WASM',officialResultsCreated:0,concurrentSessionsTested:Boolean(databaseURL)}));
} catch(e){console.error(JSON.stringify({message:e.message.slice(0,1600),where:e.where,detail:e.detail}));process.exitCode=1;} finally {await db.close();}
