import fs from 'node:fs';
import { simulateCompetitionFixture, competitionStandings } from '../packages/simulation-core/dist/competition/index.js';
import { initializeCompetitionStore, activateCompetitionStore, commitCompetitionStore, readCompetitionStore } from './lib/competition-store.mjs';

const args=process.argv.slice(2),command=args[0];
const option=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];};
const required=k=>{const value=option(k);if(!value||value.startsWith('--'))throw Error(`Supply ${k}`);return value;};
const revision=()=>{const n=Number(required('--expected-revision'));if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid expected revision');return n;};
if(!['init','activate','simulate','accept','table','verify'].includes(command))throw Error('Command: init | activate | simulate | accept | table | verify. This CLI is a local rehearsal, not a live database writer.');
const store=required('--store');let response;
if(command==='init')response=initializeCompetitionStore(store,JSON.parse(fs.readFileSync(required('--definition'),'utf8')));
else if(command==='activate')response=activateCompetitionStore(store,revision());
else if(command==='simulate') {
  const output=required('--output'),result=simulateCompetitionFixture(readCompetitionStore(store),required('--fixture'));
  fs.writeFileSync(output,JSON.stringify(result),{flag:'wx',mode:0o600});response={result:output,id:result.id,scores:result.scores};
}else if(command==='accept') {
  const result=JSON.parse(fs.readFileSync(required('--result'),'utf8'));
  const committed=commitCompetitionStore(store,result,{expectedRevision:revision(),acceptedBy:required('--actor'),acceptedAt:new Date().toISOString()});
  response={added:committed.added,revision:committed.state.revision,status:committed.state.status,acceptedMatches:committed.state.accepted.length};
}else if(command==='table')response=competitionStandings(readCompetitionStore(store));
else{const state=readCompetitionStore(store,{replay:true});response={status:'passed',revision:state.revision,replayedMatches:state.accepted.length};}
if(['init','activate'].includes(command))response={status:response.status,revision:response.revision,fixtures:response.definition.fixtures.length};
console.log(JSON.stringify({authority:'local-rehearsal',...response},null,2));
