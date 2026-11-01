import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { importDraftedTeams } from '../packages/simulation-core/dist/match/index.js';

const args=process.argv.slice(2),get=k=>{const i=args.indexOf(k);if(i<0||!args[i+1])throw Error(`Supply ${k}`);return args[i+1];};
const files=['--players','--draft','--coaches'].map(get),raw=files.map(f=>fs.readFileSync(f,'utf8'));
const draft=JSON.parse(raw[1]);if(!draft.draft_complete||draft.rounds_completed!==35)throw Error('Completed draft required');
const teams=importDraftedTeams(JSON.parse(raw[0]),draft.picks,JSON.parse(raw[2]).coaches);
const plan={status:'proposal-not-applied',competitionCategory:'men',sourceSHA256:raw.map(s=>createHash('sha256').update(s).digest('hex')),
  teamCount:teams.length,assignmentCount:teams.reduce((s,t)=>s+t.players.length,0),teams,
  prerequisites:['Resolve real database team UUIDs by category/name; never use display names as database UUIDs.',
    'Verify every proposed player exists, is active, belongs to the correct competition category, and is unassigned or already on the intended team.',
    'Check the draft/source fingerprint before one atomic import; conflicting existing assignments must abort, not be overwritten.',
    'Persist original coach preferences and the season roster snapshot before competitive fixtures are activated.'],
  effect:'This command writes a sanitized import proposal only. It makes no database changes and omits hidden development fields.'};
fs.writeFileSync(get('--output'),JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:plan.status,teams:plan.teamCount,assignments:plan.assignmentCount}));
