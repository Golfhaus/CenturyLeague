import fs from 'node:fs';
import { prepareFoundingRosterRequest } from './lib/founding-roster-import.mjs';

const args=process.argv.slice(2),get=k=>{const i=args.indexOf(k);if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw Error(`Supply ${k}`);return args[i+1];};
const request=prepareFoundingRosterRequest({playersText:fs.readFileSync(get('--players'),'utf8'),draftText:fs.readFileSync(get('--draft'),'utf8'),
  coachesText:fs.readFileSync(get('--coaches'),'utf8'),seasonId:get('--season-id')});
fs.writeFileSync(get('--output'),JSON.stringify(request,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:request.status,...request.summary,populationSHA256:request.arguments.p_population_sha256}));
