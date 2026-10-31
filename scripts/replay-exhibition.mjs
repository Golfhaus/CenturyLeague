import fs from 'node:fs';
import { simulateMatch } from '../packages/simulation-core/dist/match/index.js';

if (!process.argv[2]) throw new Error('Usage: node scripts/replay-exhibition.mjs SAVED_MATCH.json');
const saved = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const replay = simulateMatch(saved.input);
// JSON omits optional undefined properties. Compare the persisted representation,
// rather than treating omitted optional properties as different match events.
if (JSON.stringify(replay) !== JSON.stringify(saved)) {
  throw new Error('Replay differs: use the saved engine version and matching source');
}
console.log(`${saved.id}: every event, score and statistic reproduced (${saved.events.length} events).`);
