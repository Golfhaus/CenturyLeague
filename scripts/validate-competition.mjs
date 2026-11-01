import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ATTRIBUTE_KEYS } from '../packages/simulation-core/dist/types.js';
import { simulateMatch, MATCH_ENGINE_VERSION } from '../packages/simulation-core/dist/match/index.js';
import { createCompetition, activateCompetition, simulateCompetitionFixture, acceptCompetitionResult,
  competitionStandings, validateCompetitionDefinition, validateCompetitionState, competitionJSON,
  COMPETITION_ENGINE_SOURCE_SHA256 } from '../packages/simulation-core/dist/competition/index.js';
import { initializeCompetitionStore, activateCompetitionStore, commitCompetitionStore, readCompetitionStore } from './lib/competition-store.mjs';

let checks=0;
const check=fn=>{fn();checks++;};
check(()=>assert.equal(COMPETITION_ENGINE_SOURCE_SHA256,JSON.parse(fs.readFileSync(new URL('../packages/simulation-core/releases/match-engine-v0.1.json',import.meta.url))).sourceSHA256));
const clone=value=>JSON.parse(JSON.stringify(value));
const team=id=>({id,name:id,coach:{name:'Coach',tactics:{tempo:3,physicality:3,defensive_posture:3,pressure:3,
  transition_emphasis:3,width:3,aerial_emphasis:3,ball_risk:3,running_movement_emphasis:3,defensive_aggression:3}},
  players:Array.from({length:35},(_,i)=>({id:`${id}-${i}`,name:`${id} Player ${i}`,ratings:Object.fromEntries(ATTRIBUTE_KEYS.map(k=>[k,11+(i%5)*.1]))}))});
const definition={id:'test-men-2026-11',name:'Competition test',seasonKey:'2026-11',category:'men',classification:'competitive',
  engineVersion:MATCH_ENGINE_VERSION,engineSourceSHA256:COMPETITION_ENGINE_SOURCE_SHA256,
  teams:['A','B','C','D'].map(team),fixtures:[{id:'test-1',roundId:'r1',seed:'competition-test-1',teamIds:['A','B']},
    {id:'test-2',roundId:'r1',seed:'competition-test-2',teamIds:['C','D']} ]};
const draft=createCompetition(definition),active=activateCompetition(draft,0);
const r1=simulateCompetitionFixture(active,'test-1'),r2=simulateCompetitionFixture(active,'test-2');
const meta={expectedRevision:1,acceptedBy:'validation',acceptedAt:'2026-11-01T12:00:00.000Z'};
check(()=>assert.equal(draft.status,'draft'));
check(()=>assert.equal(active.revision,1));
check(()=>{const changed=clone(active);changed.definition.fixtures[0].seed='changed';assert.throws(()=>validateCompetitionState(changed),/definition changed/);});
check(()=>{const changed=clone(active);changed.definition.standingsPolicy={winPoints:2,lossPoints:0,criteria:['wins']};assert.throws(()=>validateCompetitionState(changed),/definition changed/);});
check(()=>assert.throws(()=>simulateCompetitionFixture(draft,'test-1'),/not available/));
check(()=>assert.throws(()=>activateCompetition(draft,1),/Stale/));
check(()=>assert.throws(()=>activateCompetition(active,1),/already/));
check(()=>assert.throws(()=>acceptCompetitionResult(draft,r1,meta),/not active/));
check(()=>assert.throws(()=>simulateCompetitionFixture(active,'missing'),/Unknown/));
for(const mutate of [
  d=>{d.category='mixed';},d=>{d.classification='official';},d=>{d.seasonKey='2026-13';},
  d=>{d.engineVersion='1.0';},d=>{d.engineSourceSHA256='a'.repeat(64);},
  d=>{d.teams[1].id=d.teams[0].id;},d=>{d.teams[1].players[0].id=d.teams[0].players[0].id;},
  d=>{d.teams[0].players.pop();},d=>{d.teams[0].players[0].ratings.speed=21;},
  d=>{d.fixtures[1].id=d.fixtures[0].id;},d=>{d.fixtures[1].teamIds=['A','C'];},
  d=>{d.fixtures[0].teamIds=['A','A'];},d=>{d.fixtures[0].teamIds=['A','unknown'];},
  d=>{d.standingsPolicy={winPoints:2,lossPoints:0,criteria:[]};},
  d=>{d.standingsPolicy={winPoints:2,lossPoints:0,criteria:['headToHead']};},
  d=>{d.standingsPolicy={winPoints:-1,lossPoints:0,criteria:['wins']};}
])check(()=>{const d=clone(definition);mutate(d);assert.throws(()=>validateCompetitionDefinition(d));});
const immutableBefore=competitionJSON(active);
const first=acceptCompetitionResult(active,r1,meta);
check(()=>assert.equal(first.added,true));
check(()=>assert.equal(first.state.accepted.length,1));
check(()=>assert.equal(competitionJSON(active),immutableBefore));
check(()=>assert.throws(()=>acceptCompetitionResult(first.state,r2,meta),/Stale/));
check(()=>assert.equal(acceptCompetitionResult(first.state,clone(r1),{...meta,expectedRevision:0}).added,false));
check(()=>assert.throws(()=>simulateCompetitionFixture(first.state,'test-1'),/not available/));
for(const mutate of [
  r=>{r.scores[r.winner]=101;},r=>{r.scores[1-r.winner]=100;},
  r=>{r.seed='wrong';},r=>{r.input.seed='wrong';},r=>{r.engineVersion='wrong';},
  r=>{r.input.teams.reverse();},r=>{r.input.teams[0].players[0].ratings.speed+=.2;},
  r=>{r.input.teams[0].coach.tactics.tempo=4;},r=>{r.input.provenance.competitionId='wrong';},
  r=>{r.input.provenance.competitionCategory='women';},r=>{r.input.provenance.seasonKey='2026-12';},
  r=>{r.input.provenance.classification='exhibition';},r=>{r.input.provenance.engineSourceSHA256='a'.repeat(64);},
  r=>{r.config.standardPenaltySeconds=999;},r=>{r.quarters[0].points[0]++;},
  r=>{r.players[0].stats.points=(r.players[0].stats.points??0)+1;},
  r=>{r.players[0].secondsPlayed+=1;},r=>{r.players[0].id='unrostered';},
  r=>{r.events.find(e=>e.type==='score'&&e.data.winning).data.kind='outer_air';},
  r=>{r.events[0].data.seed='tampered-ledger';}
])check(()=>{const altered=clone(r1);mutate(altered);assert.throws(()=>acceptCompetitionResult(active,altered,meta));});
check(()=>{const altered=clone(r1);altered.scores[1-altered.winner]--;assert.throws(()=>acceptCompetitionResult(first.state,altered,meta),/Conflicting/);});
check(()=>assert.throws(()=>acceptCompetitionResult(active,r1,{...meta,acceptedBy:''}),/acceptor/));
check(()=>assert.throws(()=>acceptCompetitionResult(active,r1,{...meta,acceptedAt:'invalid'}),/time/));
const done=acceptCompetitionResult(first.state,r2,{...meta,expectedRevision:2}).state;
check(()=>assert.equal(done.status,'complete'));
check(()=>assert.equal(done.revision,3));
check(()=>assert.equal(acceptCompetitionResult(done,r2,meta).added,false));
check(()=>assert.throws(()=>simulateCompetitionFixture(done,'test-2'),/not available/));
check(()=>validateCompetitionState(done,true));
check(()=>{const bad=clone(done);bad.accepted.push(clone(bad.accepted[0]));assert.throws(()=>validateCompetitionState(bad),/Duplicate/);});
const table=competitionStandings(done);
check(()=>assert.equal(table.ranked,false));
check(()=>assert.ok(table.rows.every(row=>row.rank===null&&row.tablePoints===null)));
check(()=>assert.equal(table.rows.reduce((s,row)=>s+row.played,0),4));
check(()=>assert.equal(table.rows.reduce((s,row)=>s+row.wins,0),2));
check(()=>assert.equal(table.rows.reduce((s,row)=>s+row.losses,0),2));
check(()=>assert.equal(table.rows.reduce((s,row)=>s+row.pointsFor,0),table.rows.reduce((s,row)=>s+row.pointsAgainst,0)));
const policyDefinition={...clone(definition),standingsPolicy:{winPoints:2,lossPoints:0,criteria:['tablePoints','pointDifference','pointsFor']}};
const policyFirst=acceptCompetitionResult(activateCompetition(createCompetition(policyDefinition),0),r1,meta).state;
const withPolicy=acceptCompetitionResult(policyFirst,r2,{...meta,expectedRevision:2}).state;
check(()=>assert.equal(competitionStandings(withPolicy).ranked,true));
check(()=>assert.equal(competitionStandings(withPolicy).rows.reduce((s,row)=>s+row.tablePoints,0),4));
const tied=createCompetition({...clone(definition),standingsPolicy:{winPoints:2,lossPoints:0,criteria:['wins']}});
check(()=>assert.ok(competitionStandings(tied).rows.every(row=>row.rank===1)));
const women=clone(definition);women.id='women-2026-11';women.category='women';
check(()=>assert.throws(()=>acceptCompetitionResult(activateCompetition(createCompetition(women),0),r1,meta),/scope/));
const exhibition=clone(definition);exhibition.id='exhibition-test';exhibition.classification='exhibition';
const ex=simulateCompetitionFixture(activateCompetition(createCompetition(exhibition),0),'test-1');
check(()=>assert.throws(()=>acceptCompetitionResult(active,ex,meta),/scope/));

const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'century-competition-test-'));
try{
  const file=path.join(temporary,'state.json');initializeCompetitionStore(file,definition);activateCompetitionStore(file,0);
  check(()=>assert.throws(()=>initializeCompetitionStore(file,definition),/already exists/));
  const before=fs.readFileSync(file,'utf8');
  check(()=>{fs.writeFileSync(file+'.lock','held');try{assert.throws(()=>commitCompetitionStore(file,r1,meta),/locked/);}finally{fs.unlinkSync(file+'.lock');}assert.equal(fs.readFileSync(file,'utf8'),before);});
  commitCompetitionStore(file,r1,meta);const committed=fs.readFileSync(file,'utf8');
  check(()=>{assert.equal(commitCompetitionStore(file,clone(r1),meta).added,false);assert.equal(fs.readFileSync(file,'utf8'),committed);});
  check(()=>{assert.throws(()=>commitCompetitionStore(file,r2,meta),/Stale/);assert.equal(fs.readFileSync(file,'utf8'),committed);});
  check(()=>{const corrupt=JSON.parse(committed);corrupt.state.revision++;fs.writeFileSync(file,JSON.stringify(corrupt));assert.throws(()=>readCompetitionStore(file),/checksum/);fs.writeFileSync(file,committed);});
  commitCompetitionStore(file,r2,{...meta,expectedRevision:2});
  check(()=>assert.equal(readCompetitionStore(file,{replay:true}).status,'complete'));
  check(()=>assert.ok(!fs.existsSync(file+'.lock')));
  // Competing independent processes may report busy or stale, but cannot lose or double-count a result.
  const raceFile=path.join(temporary,'race.json');initializeCompetitionStore(raceFile,definition);activateCompetitionStore(raceFile,0);
  const moduleURL=new URL('./lib/competition-store.mjs',import.meta.url).href;
  const childCode=`import fs from 'node:fs';import {commitCompetitionStore} from ${JSON.stringify(moduleURL)};try {const p=JSON.parse(fs.readFileSync(0,'utf8'));commitCompetitionStore(p.file,p.result,p.meta);process.stdout.write('accepted');}catch(e){process.stdout.write(e.message);process.exitCode=2;}`;
  const run=result=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',childCode],{stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);child.on('error',reject);child.on('close',code=>resolve({code,output}));child.stdin.end(JSON.stringify({file:raceFile,result,meta}));});
  const races=await Promise.all([run(r1),run(r2)]);
  check(()=>assert.equal(races.filter(r=>r.code===0).length,1));
  check(()=>assert.equal(readCompetitionStore(raceFile).accepted.length,1));
  check(()=>assert.equal(readCompetitionStore(raceFile).revision,2));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
console.log(JSON.stringify({checks,status:'passed',concurrentWritersTested:true,matchInputsReplayed:2,liveDatabaseWrites:0}));
