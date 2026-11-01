import fs from 'node:fs';
import path from 'node:path';
import { competitionJSON, competitionStandings } from '../packages/simulation-core/dist/competition/index.js';
import { initializeCompetitionStore, activateCompetitionStore, commitCompetitionStore, readCompetitionStore } from './lib/competition-store.mjs';

const args=process.argv.slice(2),get=k=>{const i=args.indexOf(k);if(i<0||!args[i+1])throw Error(`Supply ${k}`);return args[i+1];};
const directory=path.resolve(get('--round-directory')),file=path.resolve(get('--store'));
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
const teams=JSON.parse(fs.readFileSync(path.join(directory,'teams.json'),'utf8'));
if(manifest.status!=='exhibition'||manifest.fixtures.length!==9||teams.length!==18)throw Error('Use an existing all-club exhibition round');
const definition={id:`rehearsal:${manifest.roundId}`,name:'Local exhibition result-acceptance rehearsal',seasonKey:get('--season'),category:'men',classification:'exhibition',
  engineVersion:manifest.engineVersion,engineSourceSHA256:manifest.engineSourceSHA256,teams,
  fixtures:manifest.fixtures.map(f=>({id:f.id,roundId:manifest.roundId,seed:f.seed,teamIds:f.indices.map(i=>teams[i].id)}))};
let state;
if(fs.existsSync(file)){state=readCompetitionStore(file);if(competitionJSON(state.definition)!==competitionJSON(definition))throw Error('Rehearsal definition differs');}
else state=initializeCompetitionStore(file,definition);
if(state.status==='draft')state=activateCompetitionStore(file,state.revision);
let newlyAccepted=0,retriesIgnored=0;
for(const fixture of manifest.fixtures) {
  const result=JSON.parse(fs.readFileSync(path.join(directory,fixture.id+'.json'),'utf8'));
  const accepted=commitCompetitionStore(file,result,{expectedRevision:state.revision,acceptedBy:'local-rehearsal',acceptedAt:new Date().toISOString()});
  state=accepted.state;if(accepted.added)newlyAccepted++;else retriesIgnored++;
  if(commitCompetitionStore(file,result,{expectedRevision:state.revision-1,acceptedBy:'retry',acceptedAt:new Date().toISOString()}).added)throw Error('Retry duplicated result');
}
state=readCompetitionStore(file,{replay:true});const table=competitionStandings(state);
if(state.accepted.length!==9||table.rows.some(row=>row.played!==1)||table.rows.reduce((s,row)=>s+row.wins,0)!==9||table.ranked)throw Error('Round rehearsal failed');
console.log(JSON.stringify({authority:'local-rehearsal',classification:table.classification,status:state.status,revision:state.revision,
  acceptedMatches:state.accepted.length,newlyAccepted,retriesIgnored,exactRetryChecks:9,replayedMatches:9,
  liveDatabaseWrites:0,ranked:table.ranked,table:table.rows},null,2));
