import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { simulateMatch, matchBriefing } from '../packages/simulation-core/dist/match/index.js';

const args = process.argv.slice(2);
const option = (key, fallback) => { const i = args.indexOf(key); return i < 0 ? fallback : args[i + 1]; };
const study = path.resolve(option('--study', 'neutral-study'));
const output = path.resolve(option('--output', 'upset-audit'));
const repeats = Number(option('--stress-matches', '500'));
if (!Number.isInteger(repeats) || repeats < 20 || repeats > 5000 || repeats % 2) throw new Error('Use an even fixed sample from 20–5000 matches');
const summary = JSON.parse(fs.readFileSync(path.join(study, 'summary.json')));
const teams = JSON.parse(fs.readFileSync(path.join(study, 'teams.json')));
if (!teams.every(t => Object.values(t.coach.tactics).every(v => v === 3))) throw new Error('Use the neutral-coaching study');
const sourceFiles = ['engine.ts', 'input.ts', 'scoring.ts', 'statistics.ts', 'types.ts', 'report.ts']
  .map(f => path.join('packages/simulation-core/src/match', f))
  .concat(['random.ts', 'roleRatings.ts', 'config.ts', 'types.ts'].map(f => path.join('packages/simulation-core/src', f)));
const hash = text => createHash('sha256').update(text).digest('hex');
if (hash(sourceFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n')) !== summary.manifest.engineSourceSHA256) throw new Error('Engine changed since the study');
const swept = summary.pairs.filter(p => Math.max(...p.wins) === summary.manifest.repeatsPerPair);
if (!swept.length) throw new Error('No swept series to extend');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(path.join(output, 'samples'), { recursive: true });
const manifest = { engineVersion: summary.manifest.engineVersion, engineSourceCommit: summary.manifest.engineSourceCommit,
  engineSourceSHA256: summary.manifest.engineSourceSHA256, neutralInputSHA256: hash(JSON.stringify(teams)),
  matchesPerPair: repeats, pairings: swept.map(p => [p.a, p.b]),
  seedScheme: 'century-upset-audit-v0.1:{pairA}:{pairB}:{repeatIndex}', balancedSides: true,
  stoppingRule: 'Complete the fixed sample, regardless of whether an upset is observed; no seeds are discarded or rerolled.' };
const manifestPath = path.join(output, 'manifest.json');
if (fs.existsSync(manifestPath) && JSON.stringify(JSON.parse(fs.readFileSync(manifestPath))) !== JSON.stringify(manifest)) throw new Error('Existing audit has different settings');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(output, 'teams.json'), JSON.stringify(teams));
const mean = xs => xs.reduce((n, x) => n + x, 0) / xs.length;
function wilson(wins, total) {
  const z = 1.959963984540054, p = wins / total, denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const width = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
  return [Math.max(0, center - width), Math.min(1, center + width)];
}

/** Observational control sequences, not a new gameplay rule or a possession statistic override. */
function flowMetrics(result) {
  const metrics = [0, 1].map(() => ({ chains: 0, chainsWithShot: 0, shots: 0, scoringChains: 0,
    bonusChains: 0, points: 0, opponentControlEnds: 0, completedTackleEnds: 0, outOfBoundsEnds: 0,
    neutralRestartEnds: 0, protectedShots: 0, shotDistanceSum: 0 }));
  let chain = null;
  const close = reason => {
    if (!chain) return;
    const m = metrics[chain.side];
    m.chains++; m.chainsWithShot += chain.shots > 0 ? 1 : 0;
    m.shots += chain.shots; m.points += chain.points;
    if (chain.points > 0) m.scoringChains++;
    if (chain.bonus) m.bonusChains++;
    if (reason === 'opponent') m.opponentControlEnds++;
    if (reason === 'tackle') m.completedTackleEnds++;
    if (reason === 'out') m.outOfBoundsEnds++;
    if (reason === 'neutral') m.neutralRestartEnds++;
    chain = null;
  };
  const control = side => {
    if (chain && chain.side !== side) close('opponent');
    if (!chain) chain = { side, shots: 0, points: 0, bonus: false };
  };
  for (const e of result.events) {
    if (e.type === 'ball_up') { close('neutral'); control(e.side); }
    if (['ground_recovery', 'intercept_catch', 'interception', 'catch', 'receive'].includes(e.type)) control(e.side);
    if (e.type === 'free_kick') { close('restart'); control(e.side); }
    if (e.type === 'ball_in') close('out');
    if (e.type === 'tackle_complete') close('tackle');
    if (e.type === 'advantage_recalled') close('recall');
    if (e.type === 'kick_back') { close('restart'); control(Number(e.data.receivingSide)); }
    if (e.type === 'shot') {
      control(e.side); chain.shots++;
      metrics[e.side].protectedShots += e.data.protectedKick ? 1 : 0;
      metrics[e.side].shotDistanceSum += Number(e.data.distance);
    }
    if (e.type === 'score') {
      control(e.side); chain.points += Number(e.data.awardedPoints); chain.bonus = e.data.kind === 'bonus'; close('score');
    }
  }
  close('end');
  for (const side of [0, 1]) {
    if (metrics[side].shots !== result.teamStats[side].shots || metrics[side].points !== result.scores[side]) throw new Error('Flow audit does not reconcile');
  }
  return metrics;
}

const studyGames = fs.readFileSync(path.join(study, 'matches.ndjson'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
const teamAudit = teams.map((team, i) => {
  const games = studyGames.filter(g => g.pair.includes(i));
  const own = key => games.reduce((n, g) => n + (g.teamStats[g.pair.indexOf(i)][key] ?? 0), 0);
  const opponent = key => games.reduce((n, g) => n + (g.teamStats[1 - g.pair.indexOf(i)][key] ?? 0), 0);
  return { i, name: team.name, games: games.length, ballUpShare: own('ballUpsWon') / (own('ballUpsWon') + opponent('ballUpsWon')),
    groundRecoveryShare: own('recoveries') / (own('recoveries') + opponent('recoveries')),
    controlledTimeShare: own('possessionSeconds') / (own('possessionSeconds') + opponent('possessionSeconds')),
    passCompletion: own('completedPasses') / (own('kicks') + own('handPunches') - own('shots')),
    shotsPerMatch: own('shots') / games.length, pointsPerShot: own('points') / own('shots'),
    meanScore: own('points') / games.length };
});
const sampleFlow = fs.readdirSync(path.join(study, 'samples')).filter(f => f.endsWith('.json')).map(file => {
  const r = JSON.parse(fs.readFileSync(path.join(study, 'samples', file)));
  return { id: r.id, names: r.input.teams.map(t => t.name), metrics: flowMetrics(r) };
});
fs.writeFileSync(path.join(output, 'neutral_mechanism_audit.json'), JSON.stringify({ teamAudit, sampleFlow,
  definitions: { passCompletion: 'Controlled receptions / (kicks + hand-punches - shot kicks)',
    chains: 'Recorded control sequences ending on an opponent control, neutral restart, free-kick restart, ball-in, completed tackle or score. Same-team recoveries continue a chain.',
    scope: 'Team averages cover all 840 neutral matches; detailed chain metrics cover the 28 saved event ledgers and every fresh stress match.' } }, null, 2));

const series = [];
for (const pair of swept) {
  const key = `${pair.a}-${pair.b}`;
  const underdog = pair.wins[0] === 0 ? pair.a : pair.b;
  const completed = path.join(output, `stress-${key}.json`);
  const checkpoint = path.join(output, `stress-${key}.partial.json`);
  const games = fs.existsSync(completed) ? JSON.parse(fs.readFileSync(completed)).games :
    fs.existsSync(checkpoint) ? JSON.parse(fs.readFileSync(checkpoint)) : [];
  if (games.length > repeats) throw new Error('Checkpoint has too many matches');
  for (let n = games.length; n < repeats; n++) {
    const order = n % 2 ? [pair.b, pair.a] : [pair.a, pair.b];
    const input = { id: `upset-audit-${key}-${String(n + 1).padStart(4, '0')}`,
      seed: `century-upset-audit-v0.1:${pair.a}:${pair.b}:${n}`, teams: order.map(i => teams[i]),
      provenance: { engineSourceCommit: manifest.engineSourceCommit, engineSourceSHA256: manifest.engineSourceSHA256,
        neutralInputSHA256: manifest.neutralInputSHA256 } };
    const r = simulateMatch(input);
    const winner = order[r.winner];
    if (r.scores[r.winner] !== 100 || r.scores[1 - r.winner] >= 100 || r.quarters.length !== 4) throw new Error(`Illegal result: ${input.id}`);
    for (const side of [0, 1]) {
      if (r.players.filter(p => p.side === side).reduce((n, p) => n + (p.stats.points ?? 0), 0) !== r.scores[side]) throw new Error('Player points mismatch');
      if (r.quarters.reduce((n, q) => n + q.points[side], 0) !== r.scores[side]) throw new Error('Quarter points mismatch');
    }
    const ownSide = order.indexOf(underdog);
    const brief = matchBriefing(r);
    const row = { id: input.id, seed: input.seed, pair: [pair.a, pair.b], sides: order, winner,
      underdog, underdogWon: winner === underdog, scores: order[0] === pair.a ? r.scores : [...r.scores].reverse(),
      underdogScore: r.scores[ownSide], favoriteScore: r.scores[1 - ownSide],
      underdogSignedMargin: r.scores[ownSide] - r.scores[1 - ownSide],
      playingMinutes: r.playingSeconds / 60, leadChanges: brief.leadChanges,
      teamStats: order[0] === pair.a ? r.teamStats : [...r.teamStats].reverse(),
      flow: order[0] === pair.a ? flowMetrics(r) : flowMetrics(r).reverse(), winningPlay: brief.winningPlay };
    const previousClosest = games.filter(g => !g.underdogWon).reduce((m, g) => Math.max(m, g.underdogSignedMargin), -Infinity);
    games.push(row);
    if (n === 0 || row.underdogWon) fs.writeFileSync(path.join(output, 'samples', `${input.id}.json`), JSON.stringify(r));
    if (!row.underdogWon && row.underdogSignedMargin > previousClosest) fs.writeFileSync(path.join(output, 'samples', `closest-loss-${key}.json`), JSON.stringify(r));
    if ((n + 1) % 50 === 0 || n + 1 === repeats) {
      fs.writeFileSync(`${checkpoint}.tmp`, JSON.stringify(games)); fs.renameSync(`${checkpoint}.tmp`, checkpoint);
      console.log(`${teams[underdog].name} vs ${teams[underdog === pair.a ? pair.b : pair.a].name}: ${n + 1}/${repeats}, underdog wins ${games.filter(g => g.underdogWon).length}`);
    }
  }
  if (games.length !== repeats || new Set(games.map(g => g.seed)).size !== repeats) throw new Error('Incomplete or duplicate stress sample');
  const wins = games.filter(g => g.underdogWon).length;
  const result = { pair: [pair.a, pair.b], names: pair.names, underdog, underdogName: teams[underdog].name,
    favoriteName: teams[underdog === pair.a ? pair.b : pair.a].name, freshMatches: repeats, underdogWins: wins,
    underdogWinRate: wins / repeats, wilson95: wilson(wins, repeats), zeroWinsOneSided95Upper: wins === 0 ? 1 - 0.05 ** (1 / repeats) : null,
    originalSample: { games: summary.manifest.repeatsPerPair, wins: pair.wins },
    meanUnderdogScore: mean(games.map(g => g.underdogScore)), meanFavoriteScore: mean(games.map(g => g.favoriteScore)),
    meanUnderdogSignedMargin: mean(games.map(g => g.underdogSignedMargin)),
    closeFinishesWithin10: games.filter(g => Math.abs(g.underdogSignedMargin) <= 10).length,
    bestUnderdogMargin: Math.max(...games.map(g => g.underdogSignedMargin)),
    exampleUpsets: games.filter(g => g.underdogWon).map(g => ({ id: g.id, scores: g.scores, sides: g.sides,
      playingMinutes: g.playingMinutes, leadChanges: g.leadChanges })), games };
  fs.writeFileSync(completed, JSON.stringify(result));
  series.push(result);
}
if (hash(JSON.stringify(teams)) !== manifest.neutralInputSHA256) throw new Error('Audit changed roster inputs');
const result = { manifest, additionalMatches: series.reduce((n, s) => n + s.freshMatches, 0),
  series: series.map(({ games, ...s }) => s), teamAudit,
  caveats: ['A winless finite sample does not prove zero probability.',
    'The original 30 losses selected these pairings for investigation; fresh fixed-size trials are reported separately.',
    'No match-level upset probability floor or prescribed winner was introduced.'] };
fs.writeFileSync(path.join(output, 'audit_summary.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, teamAudit: undefined }, null, 2));
