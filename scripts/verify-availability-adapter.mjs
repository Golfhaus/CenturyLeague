import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('packages/simulation-core/src/match/engine.ts','utf8');
const replacements=[
 ["import { validateMatchInput } from './input.js';", "import { validateCompetitiveInput, COMPETITIVE_ENGINE_VERSION } from './availability.js';\nimport type { CompetitiveMatchInput } from './availability.js';"],
 ["from './scoring.js'", "from '../match/scoring.js'"],
 ["from './statistics.js'", "from '../match/statistics.js'"],
 ["from './types.js'", "from '../match/types.js'"],
 ["export const MATCH_ENGINE_VERSION = '0.1.0-exhibition';", "const MATCH_ENGINE_VERSION = COMPETITIVE_ENGINE_VERSION;"],
 ['export function simulateMatch(input: MatchInput): MatchResult', 'export function simulateCompetitiveMatch(input: CompetitiveMatchInput): MatchResult'],
 ['ExhibitionMatch', 'AvailabilityMatch'],
 ['constructor(private readonly input: MatchInput)', 'constructor(private readonly input: CompetitiveMatchInput)'],
 ['this.config = validateMatchInput(input);', "validateCompetitiveInput(input);\n    this.config = { ...DEFAULT_MATCH_CONFIG, ...input.config };"],
 ['this.rng = createRandom(`${MATCH_ENGINE_VERSION}:${input.seed}`);', "// Retain the frozen gameplay random namespace; availability must not reroll healthy matches.\n    this.rng = createRandom(`0.1.0-exhibition:${input.seed}`);"],
 ['team.players.map(p => ({', 'team.players.filter(p => input.availability.players.find(a => a.playerId === p.id)!.eligible).map(p => ({'],
 ["persistsAfterMatch: false", "persistsAfterMatch: true"],
 ["if (this.carrier === p) this.carrier = null;\n    this.tick(20, 'stoppage');",
  "if (this.carrier === p) this.carrier = null;\n    if (this.players.filter(x => x.side === p.side && x.available).length < 15)\n      throw new Error('Insufficient eligible players after injury; commissioner disposition required, no result or forced winner recorded');\n    this.tick(20, 'stoppage');"],
 ['`Exhibition ${this.input.id} exceeded safety limit;', '`Competitive ${this.input.id} exceeded safety limit;'],
];
let expected=source;
for(const [before,after]of replacements){assert.ok(expected.includes(before),`Adapter base changed: ${before}`);expected=expected.replaceAll(before,after);}
expected="// Derived from frozen match/engine.ts. The allowlisted adapter changes are checked in CI.\nimport { DEFAULT_MATCH_CONFIG } from '../match/input.js';\n"+expected;
const file='packages/simulation-core/src/competitive/engine.ts';
if(process.argv.includes('--write')){fs.mkdirSync('packages/simulation-core/src/competitive',{recursive:true});fs.writeFileSync(file,expected);}
else assert.equal(fs.readFileSync(file,'utf8'),expected,'Availability adapter has unreviewed gameplay changes');
console.log(JSON.stringify({adapter:'0.2.0-availability-candidate',frozenGameplayEdits:0,allowlistedTransformations:replacements.length,status:'passed'}));
