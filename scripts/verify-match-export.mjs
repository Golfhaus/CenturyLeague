import fs from 'node:fs';
import { verifyMatchReplay, EXACT_REPLAY_POLICY, COORDINATE_REPLAY_POLICY } from '../packages/simulation-core/dist/competition/replay.js';
const args=process.argv.slice(2),file=args.find(a=>!a.startsWith('--'));
if(!file||args.some(a=>a.startsWith('--')&&a!=='--coordinate-rounding'))throw Error('Supply an exported match JSON path; optionally --coordinate-rounding');
const saved=JSON.parse(fs.readFileSync(file,'utf8'));
const replay=verifyMatchReplay(saved.result??saved,args.includes('--coordinate-rounding')?COORDINATE_REPLAY_POLICY:EXACT_REPLAY_POLICY);
console.log(JSON.stringify({authority:'offline-verification',...replay},null,2));
if(!replay.equivalent)process.exitCode=1;
