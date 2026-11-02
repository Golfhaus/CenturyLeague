import fs from 'node:fs';
import { input } from './replay-runtime-probe.mjs';
import { pinAvailability, simulateCompetitiveMatch, CANDIDATE_RECOVERY_POLICY, recoveryDays } from '../packages/simulation-core/dist/competitive/index.js';
const match={...input,provenance:{classification:'competitive',competitionId:'runtime-probe',competitionCategory:'men'}};
const availability=pinAvailability(match,'men','2026-11-01',[
 {id:'synthetic-probe-absence',playerId:input.teams[0].players[0].id,sourceResultId:'probe-source',startsOn:'2026-10-31',recoveredOn:'2026-11-02'}
],[]);
export const candidateProbe={
 runtime:typeof Deno==='undefined'?{node:process.version,v8:process.versions.v8}:Deno.version,
 result:simulateCompetitiveMatch({...match,availability}),
 recoveryDurations:Array.from({length:100},(_,i)=>recoveryDays(CANDIDATE_RECOVERY_POLICY,'runtime-source',i+1,'probe-player'))
};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(candidateProbe));
