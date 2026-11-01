import assert from 'node:assert/strict';
import { ATTRIBUTE_KEYS } from '../packages/simulation-core/dist/types.js';
import { TACTIC_KEYS } from '../packages/simulation-core/dist/match/types.js';
import { prepareFoundingRosterRequest } from './lib/founding-roster-import.mjs';

let checks=0;const check=f=>{f();checks++;},snake=k=>k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
const population=Array.from({length:900},(_,i)=>({id:`00000000-0000-4000-8000-${i.toString(16).padStart(12,'0')}`,first_name:'Player',last_name:String(i),
  ...Object.fromEntries(ATTRIBUTE_KEYS.map(k=>[snake(k),'11.1234'])),development_potential:'PRIVATE-DO-NOT-EXPORT'}));
const names=Array.from({length:18},(_,i)=>`Team ${i}`);
const picks=population.slice(0,630).map((p,i)=>({id:p.id,team:names[i%18]}));
const coaches=names.map((team,i)=>({name:`Coach ${i}`,coach_id:`coach-${i}`,team,tactical_sliders:Object.fromEntries(TACTIC_KEYS.map(k=>[k,3])),personality:'Original profile'}));
const raw={playersText:JSON.stringify(population),draftText:JSON.stringify({draft_complete:true,rounds_completed:35,picks}),coachesText:JSON.stringify({coaches}),seasonId:'a83ac14a-9935-4c62-9182-32f02438a910'};
const request=prepareFoundingRosterRequest(raw),payload=request.arguments.p_payload;
check(()=>assert.equal(payload.teams.length,18));
check(()=>assert.ok(payload.teams.every(t=>t.playerIds.length===35)));
check(()=>assert.equal(new Set(payload.teams.flatMap(t=>t.playerIds)).size,630));
check(()=>assert.equal(request.arguments.p_source_sha256.length,3));
check(()=>assert.equal(request.arguments.p_population_sha256.length,64));
check(()=>assert.ok(!JSON.stringify(request).includes('PRIVATE-DO-NOT-EXPORT')));
check(()=>assert.deepEqual(payload.teams[0].coach,coaches[0]));
check(()=>assert.equal(payload.teams[0].playerIds[1],population[18].id));
check(()=>assert.equal(request.status,'prepared-request-not-executed'));
check(()=>assert.deepEqual(prepareFoundingRosterRequest(raw),request));
check(()=>{const reversed=[...population].reverse();assert.equal(prepareFoundingRosterRequest({...raw,playersText:JSON.stringify(reversed)}).arguments.p_population_sha256,request.arguments.p_population_sha256);});
check(()=>{const altered=structuredClone(population);altered[899].speed='11.1235';assert.notEqual(prepareFoundingRosterRequest({...raw,playersText:JSON.stringify(altered)}).arguments.p_population_sha256,request.arguments.p_population_sha256);});
for(const mutate of [
 r=>{r.seasonId='invalid';},r=>{const p=structuredClone(population);p[0].speed='21';r.playersText=JSON.stringify(p);},
 r=>{const p=structuredClone(population);p[0].speed='11.12345';r.playersText=JSON.stringify(p);},
 r=>{const p=structuredClone(population);p[0].first_name='Bad|Name';r.playersText=JSON.stringify(p);},
 r=>{const d=JSON.parse(r.draftText);d.draft_complete=false;r.draftText=JSON.stringify(d);},
 r=>{const d=JSON.parse(r.draftText);d.picks[1].id=d.picks[0].id;r.draftText=JSON.stringify(d);},
 r=>{const c=JSON.parse(r.coachesText);c.coaches[1].coach_id=c.coaches[0].coach_id;r.coachesText=JSON.stringify(c);},
 r=>{const c=JSON.parse(r.coachesText);c.coaches[0].tactical_sliders.tempo=6;r.coachesText=JSON.stringify(c);}
])check(()=>{const r={...raw};mutate(r);assert.throws(()=>prepareFoundingRosterRequest(r));});
console.log(JSON.stringify({checks,status:'passed',hiddenPlayerFieldsExported:false,liveDatabaseWrites:0}));
