import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ATTRIBUTE_KEYS } from '../packages/simulation-core/dist/types.js';
import { TACTIC_KEYS } from '../packages/simulation-core/dist/match/types.js';
import { simulateMatch } from '../packages/simulation-core/dist/match/engine.js';

// Entirely fictional, deterministic inputs: no live roster or authentication data.
export const input={id:'portable-replay-fixture',seed:'portable-replay-2026-11',teams:[0,1].map(side=>({
 id:`club-${side}`,name:`Replay club ${side}`,coach:{name:`Coach ${side}`,tactics:Object.fromEntries(TACTIC_KEYS.map((k,i)=>[k,1+(i+side)%5]))},
 players:Array.from({length:35},(_,i)=>({id:`player-${side}-${i}`,name:`Player ${side}-${i}`,ratings:Object.fromEntries(ATTRIBUTE_KEYS.map((k,j)=>[k,7+(i+j+side)%9]))}))
}))};
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href&&process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({runtime:typeof Deno==='undefined'?{node:process.version,v8:process.versions.v8}:Deno.version,result:simulateMatch(input)}));
