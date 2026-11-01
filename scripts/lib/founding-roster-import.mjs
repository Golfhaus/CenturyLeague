import { createHash } from 'node:crypto';
import { ATTRIBUTE_KEYS } from '../../packages/simulation-core/dist/types.js';
import { importDraftedTeams } from '../../packages/simulation-core/dist/match/index.js';

const hash=text=>createHash('sha256').update(text).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const snake=k=>k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
export function prepareFoundingRosterRequest({playersText,draftText,coachesText,seasonId}) {
  if(!uuid.test(seasonId))throw Error('A database season UUID is required');
  const population=JSON.parse(playersText),draft=JSON.parse(draftText),coaches=JSON.parse(coachesText).coaches;
  if(!Array.isArray(population)||population.length!==900||!draft.draft_complete||draft.rounds_completed!==35||!Array.isArray(coaches)||coaches.length!==18)throw Error('Complete founding population/draft/coaches required');
  const teams=importDraftedTeams(population,draft.picks,coaches);
  const lines=[...population].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(p=>{
    if(!uuid.test(p.id)||typeof p.first_name!=='string'||typeof p.last_name!=='string'||/[|\r\n]/.test(p.first_name+p.last_name))throw Error('Invalid canonical player identity');
    const values=ATTRIBUTE_KEYS.map(key=>{
      const value=Number(p[snake(key)]);
      if(!Number.isFinite(value)||value<1||value>20||Number(value.toFixed(4))!==value)throw Error('Founding database attributes require exact 1–20 values at four-decimal precision');
      return value.toFixed(4);
    });
    return [p.id,p.first_name,p.last_name,...values].join('|');
  });
  if(coaches.some(c=>typeof c.coach_id!=='string'||!c.coach_id.trim())||new Set(coaches.map(c=>c.coach_id)).size!==18)throw Error('Unique original coach identities required');
  return {function:'import_founding_rosters_v1',status:'prepared-request-not-executed',arguments:{
    p_season_id:seasonId,p_source_sha256:[playersText,draftText,coachesText].map(hash),p_population_sha256:hash(lines.join('\n')),
    p_payload:{competitionCategory:'men',teams:teams.map(t=>({name:t.name,
      coach:structuredClone(coaches.find(c=>c.team===t.name)),playerIds:t.players.map(p=>p.id)}))}},
    summary:{teams:18,coaches:18,players:630,unassigned:270},
    execution:'Send arguments only through an authorized backend/service-role connection. The function validates and commits atomically; this preparer performs no database writes.'};
}
