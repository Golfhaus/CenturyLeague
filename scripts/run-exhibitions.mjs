import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { importDraftedTeams, simulateMatch, matchBriefing, matchReportMarkdown } from '../packages/simulation-core/dist/match/index.js';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1]; };
const playerPath = option('--players');
const draftPath = option('--draft');
const coachPath = option('--coaches');
if (!playerPath || !draftPath || !coachPath) {
  console.error('Usage: node scripts/run-exhibitions.mjs --players CANONICAL_PUBLIC_OR_FULL_SNAPSHOT.json --draft ROUND_35.json --coaches COACHES.json [--output DIRECTORY] [--repeats 10]');
  process.exit(1);
}
const repeats = Number(option('--repeats', '10'));
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 1000) throw new Error('repeats must be 1–1000');
const output = path.resolve(option('--output', 'exhibitions'));
const files = [playerPath, draftPath, coachPath].map(p => fs.readFileSync(p, 'utf8'));
const population = JSON.parse(files[0]);
const draft = JSON.parse(files[1]);
if (!draft.draft_complete || draft.rounds_completed !== 35) throw new Error('Draft must be complete through round 35');
const teams = importDraftedTeams(population, draft.picks, JSON.parse(files[2]).coaches);
const selection = [
  { name: 'Asheville Highland', category: 'balanced', reason: 'Broad coverage across contest, distribution, aerial, defense, running, finishing and endurance.' },
  { name: 'Anacostia United', category: 'balanced', reason: 'Broad functional coverage with a modest distribution/running emphasis.' },
  { name: 'Lancaster Red Rose CC', category: 'specialized', reason: 'Finishing-heavy roster, direct scoring and high ball risk; comparatively weaker defensive coverage.' },
  { name: 'Hampden Works CC', category: 'specialized', reason: 'Defensive/aerial emphasis, deep posture and immediate counters; comparatively weaker finishing.' }
];
const selected = selection.map(s => teams.find(t => t.name === s.name));
if (selected.some(t => !t)) throw new Error('Exhibition club absent from draft');
const provenance = { playerSnapshotDriveId: String(draft.canonical_snapshot_drive_document_id),
  playerSnapshotSHA256: createHash('sha256').update(files[0]).digest('hex'),
  draftSHA256: createHash('sha256').update(files[1]).digest('hex'),
  coachesSHA256: createHash('sha256').update(files[2]).digest('hex') };
fs.mkdirSync(output, { recursive: true });
// This is only public match input, never hidden development variables or credentials.
fs.writeFileSync(path.join(output, 'exhibition_teams.json'), JSON.stringify({ provenance, selection, teams: selected }, null, 2));
const briefings = [];
const batch = [];
let elapsedMs = 0;
for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
  const matchup = [];
  for (let n = 0; n < repeats; n++) {
    const order = n % 2 ? [b, a] : [a, b];
    const id = `exhibition-${a + 1}${b + 1}-${String(n + 1).padStart(3, '0')}`;
    const input = { id, seed: `century-v0.1:${a}:${b}:${n}`, teams: order.map(i => selected[i]), provenance };
    const start = performance.now();
    const result = simulateMatch(input);
    elapsedMs += performance.now() - start;
    const briefing = matchBriefing(result);
    matchup.push({ id, teams: order.map(i => selection[i].name), scores: result.scores,
      winner: briefing.winner, playingMinutes: briefing.playingMinutes,
      elapsedMinutes: briefing.elapsedMinutes, events: result.events.length,
      teamStats: result.teamStats, participants: [0, 1].map(s => result.players.filter(p => p.side === s && p.secondsPlayed > 0).length) });
    // Keep one complete ledger per matchup; repeat runs retain compact diagnostics.
    if (n === 0) {
      fs.writeFileSync(path.join(output, `${id}.json`), JSON.stringify(result));
      fs.writeFileSync(path.join(output, `${id}.md`), matchReportMarkdown(result));
      briefings.push(briefing);
    }
  }
  batch.push(...matchup);
}
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const summary = { engineVersion: '0.1.0-exhibition', selection, matches: batch.length,
  repeatsPerPair: repeats, alternatesSides: true, benchmarkMillisecondsPerMatch: elapsedMs / batch.length,
  playingMinutes: { mean: mean(batch.map(m => m.playingMinutes)), min: Math.min(...batch.map(m => m.playingMinutes)), max: Math.max(...batch.map(m => m.playingMinutes)) },
  elapsedMinutes: { mean: mean(batch.map(m => m.elapsedMinutes)), min: Math.min(...batch.map(m => m.elapsedMinutes)), max: Math.max(...batch.map(m => m.elapsedMinutes)) },
  clubs: selection.map(s => {
    const games = batch.filter(m => m.teams.includes(s.name));
    return { name: s.name, played: games.length, wins: games.filter(m => m.winner === s.name).length,
      meanScore: mean(games.map(m => m.scores[m.teams.indexOf(s.name)])),
      meanShots: mean(games.map(m => m.teamStats[m.teams.indexOf(s.name)].shots ?? 0)),
      meanTackles: mean(games.map(m => m.teamStats[m.teams.indexOf(s.name)].tackles ?? 0)),
      meanCatches: mean(games.map(m => m.teamStats[m.teams.indexOf(s.name)].catches ?? 0)),
      meanParticipants: mean(games.map(m => m.participants[m.teams.indexOf(s.name)])) };
  }), matchesDetail: batch };
fs.writeFileSync(path.join(output, 'calibration.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(output, 'round_briefing.json'), JSON.stringify({ status: 'exhibition', matches: briefings }, null, 2));
console.log(JSON.stringify({ ...summary, matchesDetail: undefined }, null, 2));
