import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { importDraftedTeams, simulateMatch, matchBriefing, TACTIC_KEYS, MATCH_ENGINE_VERSION } from '../packages/simulation-core/dist/match/index.js';

const args = process.argv.slice(2);
const option = (key, fallback) => { const i = args.indexOf(key); return i < 0 ? fallback : args[i + 1]; };
const files = ['--players', '--draft', '--coaches'].map(k => option(k));
if (files.some(f => !f)) throw new Error('Supply --players, --draft and --coaches canonical files');
const condition = option('--condition', 'original');
if (!['original', 'neutral'].includes(condition)) throw new Error('--condition must be original or neutral');
const club = option('--club', 'Wilmington Cape CC');
const repeats = Number(option('--repeats', '50'));
if (!Number.isInteger(repeats) || repeats < 2 || repeats > 2000 || repeats % 2) throw new Error('Use an even number of matches per opponent');
const output = path.resolve(option('--output', 'club-opponent-study'), condition);
const raw = files.map(f => fs.readFileSync(f, 'utf8'));
const draft = JSON.parse(raw[1]);
if (!draft.draft_complete || draft.rounds_completed !== 35) throw new Error('Draft must be complete');
const originalTeams = importDraftedTeams(JSON.parse(raw[0]), draft.picks, JSON.parse(raw[2]).coaches);
const teams = originalTeams.map(t => condition === 'neutral' ? { ...t, coach: { ...t.coach,
  tactics: Object.fromEntries(TACTIC_KEYS.map(key => [key, 3])) } } : t);
const index = teams.findIndex(t => t.name === club);
if (index < 0) throw new Error('Selected club is absent from the draft');
const opponents = teams.map((_, i) => i).filter(i => i !== index);
const hash = s => createHash('sha256').update(s).digest('hex');
const sourceFiles = ['engine.ts', 'input.ts', 'scoring.ts', 'statistics.ts', 'types.ts', 'report.ts']
  .map(f => path.join('packages/simulation-core/src/match', f))
  .concat(['random.ts', 'roleRatings.ts', 'config.ts', 'types.ts'].map(f => path.join('packages/simulation-core/src', f)));
const engineSourceSHA256 = hash(sourceFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n'));
const originalInputSHA256 = hash(JSON.stringify(originalTeams));
const manifest = { engineVersion: MATCH_ENGINE_VERSION, engineSourceCommit: 'ebd0a56161e2536fdaa167f376f05b3b303dc9bd',
  engineSourceSHA256, condition, club, clubIndex: index, opponents: opponents.map(i => teams[i].name),
  repeatsPerOpponent: repeats, expectedMatches: opponents.length * repeats, sourceSHA256: raw.map(hash),
  originalInputSHA256, conditionInputSHA256: hash(JSON.stringify(teams)),
  seedScheme: 'century-club-sampling-v0.1:{clubIndex}:{opponentIndex}:{repeatIndex}',
  sidesPerOpponent: [repeats / 2, repeats / 2], carryover: 'none',
  stoppingRule: 'Complete every opponent series; no outcome-based early stopping or seed rerolls.' };
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(path.join(output, 'samples'), { recursive: true });
const manifestPath = path.join(output, 'manifest.json');
if (fs.existsSync(manifestPath) && JSON.stringify(JSON.parse(fs.readFileSync(manifestPath))) !== JSON.stringify(manifest)) throw new Error('Existing output has different inputs or settings');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(output, 'teams.json'), JSON.stringify(teams));
const mean = xs => xs.reduce((n, x) => n + x, 0) / xs.length;
function wilson(wins, total) {
  const z = 1.959963984540054, p = wins / total, d = 1 + z*z/total;
  const center = (p + z*z/(2*total))/d;
  const width = z*Math.sqrt(p*(1-p)/total + z*z/(4*total*total))/d;
  return [Math.max(0,center-width),Math.min(1,center+width)];
}
const allGames = [];
const series = [];
for (const opponent of opponents) {
  const checkpoint = path.join(output, `opponent-${String(opponent).padStart(2, '0')}.json`);
  let games;
  if (fs.existsSync(checkpoint)) {
    games = JSON.parse(fs.readFileSync(checkpoint));
    if (games.length !== repeats) throw new Error('Incomplete checkpoint');
  } else {
    games = [];
    for (let n = 0; n < repeats; n++) {
      const order = n % 2 ? [opponent, index] : [index, opponent];
      const input = { id: `club-study-${index}-${opponent}-${String(n + 1).padStart(3,'0')}`,
        seed: `century-club-sampling-v0.1:${index}:${opponent}:${n}`, teams: order.map(i => teams[i]),
        provenance: { engineSourceCommit: manifest.engineSourceCommit, engineSourceSHA256,
          condition, conditionInputSHA256: manifest.conditionInputSHA256,
          playerSnapshotSHA256: manifest.sourceSHA256[0], draftSHA256: manifest.sourceSHA256[1], coachSHA256: manifest.sourceSHA256[2] } };
      const r = simulateMatch(input);
      if (r.scores[r.winner] !== 100 || r.scores[1-r.winner] >= 100 || r.quarters.length !== 4) throw new Error('Illegal result');
      for (const side of [0,1]) {
        if (r.players.filter(p => p.side === side).reduce((s,p) => s+(p.stats.points??0),0) !== r.scores[side]) throw new Error('Player points mismatch');
        if (r.quarters.reduce((s,q) => s+q.points[side],0) !== r.scores[side]) throw new Error('Quarter points mismatch');
      }
      const ownSide = order.indexOf(index);
      const brief = matchBriefing(r);
      games.push({ id: input.id, seed: input.seed, condition, opponent, sides: order,
        clubWon: order[r.winner] === index, scores: [r.scores[ownSide],r.scores[1-ownSide]],
        signedMargin: r.scores[ownSide]-r.scores[1-ownSide], playingMinutes: r.playingSeconds/60,
        elapsedMinutes: r.elapsedSeconds/60, leadChanges: brief.leadChanges,
        teamStats: [r.teamStats[ownSide],r.teamStats[1-ownSide]],
        participants: [index,opponent].map(i => r.players.filter(p => p.side === order.indexOf(i) && p.secondsPlayed>0).length),
        players: r.players.map(p => ({...p,teamIndex:order[p.side]})),
        quarters: r.quarters.map(q => ({...q,points:[q.points[ownSide],q.points[1-ownSide]],
          cumulative:[q.cumulative[ownSide],q.cumulative[1-ownSide]]})), winningPlay: brief.winningPlay });
      if (n === 0) fs.writeFileSync(path.join(output,'samples',`${input.id}.json`),JSON.stringify(r));
    }
    fs.writeFileSync(`${checkpoint}.tmp`,JSON.stringify(games));fs.renameSync(`${checkpoint}.tmp`,checkpoint);
  }
  allGames.push(...games);
  const wins = games.filter(g => g.clubWon).length;
  const total = (key, side) => games.reduce((s,g) => s+(g.teamStats[side][key]??0),0);
  series.push({ opponent, opponentName: teams[opponent].name, wins, losses: repeats-wins, winRate:wins/repeats,
    wilson95:wilson(wins,repeats), meanFor:mean(games.map(g=>g.scores[0])), meanAgainst:mean(games.map(g=>g.scores[1])),
    meanSignedMargin:mean(games.map(g=>g.signedMargin)), minSignedMargin:Math.min(...games.map(g=>g.signedMargin)),
    maxSignedMargin:Math.max(...games.map(g=>g.signedMargin)), closeFinishesWithin10:games.filter(g=>Math.abs(g.signedMargin)<=10).length,
    ballUpShare:total('ballUpsWon',0)/(total('ballUpsWon',0)+total('ballUpsWon',1)),
    groundRecoveryShare:total('recoveries',0)/(total('recoveries',0)+total('recoveries',1)),
    shotShare:total('shots',0)/(total('shots',0)+total('shots',1)),
    ownShotsPerMatch:total('shots',0)/repeats, opponentShotsPerMatch:total('shots',1)/repeats,
    pointsPerShot:total('points',0)/total('shots',0), opponentPointsPerShot:total('points',1)/total('shots',1),
    passCompletion:total('completedPasses',0)/(total('kicks',0)+total('handPunches',0)-total('shots',0)),
    meanPlayingMinutes:mean(games.map(g=>g.playingMinutes)) });
  console.log(`${condition}: ${allGames.length}/${manifest.expectedMatches} | ${club} ${wins}-${repeats-wins} ${teams[opponent].name}`);
}
if (allGames.length !== manifest.expectedMatches || new Set(allGames.map(g=>g.seed)).size !== allGames.length ||
  hash(JSON.stringify(originalTeams)) !== originalInputSHA256) throw new Error('Study completeness/immutability check failed');
const wins = allGames.filter(g=>g.clubWon).length;
const result = { manifest, matches:allGames.length, wins, losses:allGames.length-wins, winRate:wins/allGames.length,
  favorableSeries:series.filter(s=>s.wins>repeats/2).length, evenSeries:series.filter(s=>s.wins===repeats/2).length,
  unfavorableSeries:series.filter(s=>s.wins<repeats/2).length,
  atLeast80PercentWinsSeries:series.filter(s=>s.wins>=repeats*.8).length,
  atMost20PercentWinsSeries:series.filter(s=>s.wins<=repeats*.2).length,
  winlessSeries:series.filter(s=>s.wins===0).length, sweepWins:series.filter(s=>s.wins===repeats).length,
  meanSignedMargin:mean(allGames.map(g=>g.signedMargin)), meanPlayingMinutes:mean(allGames.map(g=>g.playingMinutes)),
  closeFinishesWithin10:allGames.filter(g=>Math.abs(g.signedMargin)<=10).length, series };
fs.writeFileSync(path.join(output,'matches.ndjson'),allGames.map(g=>JSON.stringify(g)).join('\n')+'\n');
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,manifest:undefined,series:undefined},null,2));
