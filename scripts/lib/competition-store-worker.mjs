import fs from 'node:fs';
import { executeCompetitionMutation } from './competition-store.mjs';

try {
  const operation=JSON.parse(fs.readFileSync(0,'utf8'));
  const result=executeCompetitionMutation(process.argv[2],operation);
  process.stdout.write(JSON.stringify(result));
}catch(error){process.stderr.write(error.message+'\n');process.exitCode=2;}
