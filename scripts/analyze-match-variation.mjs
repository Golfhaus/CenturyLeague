import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { importDraftedTeams, simulateMatch, matchBriefing, MATCH_ENGINE_VERSION } from '../packages/simulation-core/dist/match/index.js';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1]; };
const sources = ['--players', '--draft', '--coaches'].map(k => option(k));
if (sources.some(p => !p)) throw new Error('Usage: node scripts/analyze-match-variation.mjs --players POPULATION.json --draft ROUND_35.json --coaches COACHES.json [--output DIRECTORY] [--repeats 30] [--teams NAMES.json]');
const repeats = Number(option('--repeats', '30'));
if (!Number.isInteger(repeats) || repeats < 2 || repeats > 1000 || repeats % 2) throw new Error('Use an even number of repeats from 2–1000 to balance sides');
const output = path.resolve(option('--output', 'variation-exhibitions'));
const raw = sources.map(p => fs.readFileSync(p, 'utf8'));
const draft = JSON.parse(raw[1]);
if (!draft.draft_complete || draft.rounds_completed !== 35) throw new Error('A completed founding draft is required');
const allTeams = importDraftedTeams(JSON.parse(raw[0]), draft.picks, JSON.parse(raw[2]).coaches);
const names = option('--teams') ? JSON.parse(fs.readFileSync(option('--teams'), 'utf8')) : [
  'Asheville Highland', 'Anacostia United', 'Lancaster Red Rose CC', 'Hampden Works CC',
  'Wilmington Cape CC', 'Erie City Rovers', 'Frederick Forge', 'Greensboro Crescent CC'
];
if (!Array.isArray(names) || names.length !== 8 || new Set(names).size !== 8) throw new Error('Select exactly eight distinct clubs');
const teams = names.map(name => allTeams.find(t => t.name === name));
if (teams.some(t => !t)) throw new Error('Selected club is not present in the canonical draft');
const digest = s => createHash('sha256').update(s).digest('hex');
const sourceFiles = ['engine.ts', 'input.ts', 'scoring.ts', 'statistics.ts', 'types.ts', 'report.ts']
  .map(f => path.join('packages/simulation-core/src/match', f))
  .concat(['random.ts', 'roleRatings.ts', 'config.ts', 'types.ts'].map(f => path.join('packages/simulation-core/src', f)));
const engineSourceSHA256 = digest(sourceFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n'));
const manifest = { engineVersion: MATCH_ENGINE_VERSION, engineSourceCommit: 'ebd0a56161e2536fdaa167f376f05b3b303dc9bd',
  engineSourceSHA256, selection: names, repeatsPerPair: repeats, expectedMatches: names.length * (names.length - 1) / 2 * repeats,
  seedScheme: 'century-variation-v0.1:{pairA}:{pairB}:{repeatIndex}',
  alternatesSides: true, carryover: 'none: fresh fatigue and availability for every match',
  sourceSHA256: raw.map(digest), inputSHA256: digest(JSON.stringify(teams)),
  notes: 'Same frozen v0.1 exhibition engine and defaults; no parameters adjusted to obtain a desired split.' };
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(path.join(output, 'samples'), { recursive: true });
const manifestPath = path.join(output, 'manifest.json');
if (fs.existsSync(manifestPath) && JSON.stringify(JSON.parse(fs.readFileSync(manifestPath))) !== JSON.stringify(manifest)) {
  throw new Error('Existing run has different input or source; use a new output directory');
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(output, 'teams.json'), JSON.stringify(teams));
const allGames = [];
const pairs = [];
const begin = performance.now();
const mean = values => values.reduce((n, v) => n + v, 0) / values.length;
const sd = values => Math.sqrt(mean(values.map(v => (v - mean(values)) ** 2)));
const quantile = (values, q) => { const sorted = [...values].sort((a, b) => a - b); const at = (sorted.length - 1) * q;
  return sorted[Math.floor(at)] + (sorted[Math.ceil(at)] - sorted[Math.floor(at)]) * (at % 1); };
const distribution = values => ({ min: Math.min(...values), p10: quantile(values, 0.1), p25: quantile(values, 0.25),
  median: quantile(values, 0.5), mean: mean(values), p75: quantile(values, 0.75), p90: quantile(values, 0.9),
  max: Math.max(...values), sd: sd(values) });
let firstSideWins = 0;
for (let a = 0; a < teams.length; a++) for (let b = a + 1; b < teams.length; b++) {
  const pairKey = `${String(a + 1).padStart(2, '0')}-${String(b + 1).padStart(2, '0')}`;
  const checkpoint = path.join(output, `pair-${pairKey}.json`);
  let games;
  if (fs.existsSync(checkpoint)) {
    games = JSON.parse(fs.readFileSync(checkpoint));
    if (games.length !== repeats) throw new Error(`Incomplete pair checkpoint: ${pairKey}`);
  } else {
    games = [];
    for (let n = 0; n < repeats; n++) {
      const order = n % 2 ? [b, a] : [a, b];
      const id = `variation-${pairKey}-${String(n + 1).padStart(2, '0')}`;
      const input = { id, seed: `century-variation-v0.1:${a}:${b}:${n}`, teams: order.map(i => teams[i]),
        provenance: { engineSourceCommit: manifest.engineSourceCommit, engineSourceSHA256,
          playerSnapshotSHA256: manifest.sourceSHA256[0], draftSHA256: manifest.sourceSHA256[1], coachesSHA256: manifest.sourceSHA256[2] } };
      const start = performance.now();
      const r = simulateMatch(input);
      const milliseconds = performance.now() - start;
      if (r.scores[r.winner] !== 100 || r.scores[1 - r.winner] >= 100 || r.quarters.length !== 4) throw new Error(`Illegal result: ${id}`);
      for (const side of [0, 1]) {
        if (r.players.filter(p => p.side === side).reduce((s, p) => s + (p.stats.points ?? 0), 0) !== r.scores[side]) throw new Error(`Player points do not reconcile: ${id}`);
        if (r.quarters.reduce((s, q) => s + q.points[side], 0) !== r.scores[side]) throw new Error(`Quarter points do not reconcile: ${id}`);
      }
      const brief = matchBriefing(r);
      games.push({ id, pair: [a, b], repeat: n, seed: input.seed, sides: order,
        winner: order[r.winner], firstSideWinner: r.winner === 0,
        scores: order[0] === a ? r.scores : [...r.scores].reverse(),
        margin: 100 - r.scores[1 - r.winner], playingMinutes: r.playingSeconds / 60,
        elapsedMinutes: r.elapsedSeconds / 60, leadChanges: brief.leadChanges, largestLead: brief.largestLead,
        quarters: r.quarters.map(q => ({ ...q, cumulative: order[0] === a ? q.cumulative : [...q.cumulative].reverse(),
          points: order[0] === a ? q.points : [...q.points].reverse() })),
        teamStats: order[0] === a ? r.teamStats : [...r.teamStats].reverse(),
        participants: [a, b].map(i => r.players.filter(p => p.side === order.indexOf(i) && p.secondsPlayed > 0).length),
        players: r.players.map(p => ({ ...p, teamIndex: order[p.side] })),
        winningPlay: brief.winningPlay, events: r.events.length, milliseconds });
      if (n === 0) fs.writeFileSync(path.join(output, 'samples', `${id}.json`), JSON.stringify(r));
    }
    fs.writeFileSync(`${checkpoint}.tmp`, JSON.stringify(games));
    fs.renameSync(`${checkpoint}.tmp`, checkpoint);
  }
  allGames.push(...games);
  const aWins = games.filter(g => g.winner === a).length;
  const signedMargins = games.map(g => g.winner === a ? g.margin : -g.margin);
  const pair = { a, b, names: [names[a], names[b]], wins: [aWins, repeats - aWins],
    majorityWins: Math.max(aWins, repeats - aWins), distinctScorelines: new Set(games.map(g => g.scores.join('-'))).size,
    firstSideWins: games.filter(g => g.firstSideWinner).length,
    signedMargin: distribution(signedMargins), absoluteMargin: distribution(games.map(g => g.margin)),
    playingMinutes: distribution(games.map(g => g.playingMinutes)),
    onePointFinishes: games.filter(g => g.margin === 1).length,
    closeFinishesWithin10: games.filter(g => g.margin <= 10).length,
    largeMarginsAtLeast30: games.filter(g => g.margin >= 30).length,
    meanLeadChanges: mean(games.map(g => g.leadChanges)) };
  pairs.push(pair);
  firstSideWins += pair.firstSideWins;
  console.log(`${allGames.length}/${manifest.expectedMatches} | ${names[a]} ${aWins}-${repeats - aWins} ${names[b]} | ${pair.distinctScorelines} scorelines | mean margin ${pair.absoluteMargin.mean.toFixed(1)}`);
}
if (allGames.length !== manifest.expectedMatches || new Set(allGames.map(g => g.id)).size !== allGames.length ||
  new Set(allGames.map(g => g.seed)).size !== allGames.length) throw new Error('Missing or repeated match/seed');
const clubs = teams.map((team, i) => {
  const games = allGames.filter(g => g.pair.includes(i));
  if (games.length !== (teams.length - 1) * repeats) throw new Error(`Unexpected games for ${team.name}`);
  const sideWins = [0, 1].map(side => games.filter(g => g.sides[side] === i && g.winner === i).length);
  const score = g => g.scores[g.pair.indexOf(i)];
  const conceded = g => g.scores[1 - g.pair.indexOf(i)];
  const stat = (g, key) => g.teamStats[g.pair.indexOf(i)][key] ?? 0;
  const role = team.players.map(p => p.ratings);
  return { i, name: team.name, coach: team.coach.name, played: games.length,
    wins: games.filter(g => g.winner === i).length, losses: games.filter(g => g.winner !== i).length,
    sideWins, meanFor: mean(games.map(score)), meanAgainst: mean(games.map(conceded)),
    meanSignedMargin: mean(games.map(g => score(g) - conceded(g))),
    meanShots: mean(games.map(g => stat(g, 'shots'))), meanCatches: mean(games.map(g => stat(g, 'catches'))),
    meanTackles: mean(games.map(g => stat(g, 'tackles'))), meanTurnovers: mean(games.map(g => stat(g, 'turnovers'))),
    meanParticipants: mean(games.map(g => g.participants[g.pair.indexOf(i)])),
    initialAttributeMeans: Object.fromEntries(Object.keys(role[0]).map(k => [k, mean(role.map(p => p[k]))])) };
});
const summary = { manifest, matches: allGames.length, pairings: pairs.length,
  runtimeSeconds: allGames.reduce((n, g) => n + g.milliseconds, 0) / 1000,
  wallSecondsThisInvocation: (performance.now() - begin) / 1000,
  firstSideWins, exactEvenSeries: pairs.filter(p => p.wins[0] === p.wins[1]).length,
  sweeps: pairs.filter(p => p.majorityWins === repeats).length,
  atLeast90PercentSeries: pairs.filter(p => p.majorityWins >= repeats * 0.9).length,
  atLeast80PercentSeries: pairs.filter(p => p.majorityWins >= repeats * 0.8).length,
  bothTeamsAtLeast10Wins: pairs.filter(p => Math.min(...p.wins) >= 10).length,
  majorityWinDistribution: Object.fromEntries([...new Set(pairs.map(p => p.majorityWins))].sort((a, b) => a - b)
    .map(w => [String(w), pairs.filter(p => p.majorityWins === w).length])),
  margin: distribution(allGames.map(g => g.margin)), playingMinutes: distribution(allGames.map(g => g.playingMinutes)),
  onePointFinishes: allGames.filter(g => g.margin === 1).length,
  closeFinishesWithin10: allGames.filter(g => g.margin <= 10).length,
  largeMarginsAtLeast30: allGames.filter(g => g.margin >= 30).length,
  comebackWinsAfterTrailingAt75: allGames.filter(g => { const q = g.quarters[2].cumulative;
    const k = g.pair.indexOf(g.winner); return q[k] < q[1 - k]; }).length,
  clubs, pairs };
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(output, 'matches.ndjson'), allGames.map(g => JSON.stringify(g)).join('\n') + '\n');
console.log(JSON.stringify({ ...summary, manifest: undefined, clubs: undefined, pairs: undefined }, null, 2));
