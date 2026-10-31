import type { MatchResult, Side } from './types.js';

export function matchBriefing(result: MatchResult) {
  const scoring = result.events.filter(e => e.type === 'score');
  let leader: Side | null = null;
  let largestLead = 0;
  let leadChanges = 0;
  let runSide: Side | null = null;
  let run = 0;
  let bestRun = { side: 0 as Side, points: 0, endingEventId: 0 };
  const leads: { eventId: number; side: Side; margin: number }[] = [];
  for (const e of scoring) {
    const [a, b] = e.data!.scores as [number, number];
    const next = a === b ? null : a > b ? 0 : 1;
    if (next !== null && next !== leader) {
      if (leader !== null) leadChanges++;
      leads.push({ eventId: e.id, side: next, margin: Math.abs(a - b) });
      leader = next;
    }
    largestLead = Math.max(largestLead, Math.abs(a - b));
    const awarded = Number(e.data!.awardedPoints);
    if (awarded > 0) {
      run = runSide === e.side ? run + awarded : awarded;
      runSide = e.side!;
      if (run > bestRun.points) bestRun = { side: e.side!, points: run, endingEventId: e.id };
    }
  }
  const names = new Map(result.players.map(p => [p.id, p.name]));
  const winningPlay = scoring.find(e => e.data!.winning)!;
  const topScorers = [...result.players].sort((a, b) => (b.stats.points ?? 0) - (a.stats.points ?? 0)).slice(0, 6)
    .map(p => ({ id: p.id, name: p.name, team: result.input.teams[p.side].name, points: p.stats.points ?? 0,
      centralAirScores: p.stats.centralAirScores ?? 0, shots: p.stats.shots ?? 0 }));
  const noteworthy = result.events.filter(e => ['penalty_start', 'injury', 'advantage_recalled', 'kick_back'].includes(e.type))
    .map(e => ({ eventId: e.id, quarter: e.quarter, playingSeconds: e.playingSeconds,
      type: e.type, player: names.get(e.playerId!), team: e.side === undefined ? undefined : result.input.teams[e.side].name,
      detail: e.data }));
  return { id: result.id, engineVersion: result.engineVersion, seed: result.seed,
    teams: result.input.teams.map(t => t.name), scores: result.scores,
    winner: result.input.teams[result.winner].name,
    playingMinutes: result.playingSeconds / 60, elapsedMinutes: result.elapsedSeconds / 60,
    quarters: result.quarters, topScorers, leadChanges, largestLead, largestScoringRun: bestRun,
    leadHistory: leads, teamStats: result.teamStats,
    winningPlay: { eventId: winningPlay.id, player: names.get(winningPlay.playerId!),
      awardedPoints: Number(winningPlay.data!.awardedPoints),
      quarter: winningPlay.quarter, playingSeconds: winningPlay.playingSeconds, ...winningPlay.data },
    noteworthy,
    evidencePolicy: 'Use only these recorded facts and cited event IDs. Do not invent dialogue, injuries, crowd reactions, or tactical causes.',
    standings: null };
}

export function matchReportMarkdown(result: MatchResult): string {
  const b = matchBriefing(result);
  const names = result.input.teams.map(t => t.name);
  const lines = [`# Exhibition: ${names[0]} ${result.scores[0]}–${result.scores[1]} ${names[1]}`, '',
    `Engine ${result.engineVersion} · seed \`${result.seed}\` · ${result.events.length} events`, '',
    `**Winner:** ${b.winner}. Playing time: ${b.playingMinutes.toFixed(1)} minutes. ` +
      `Elapsed time, including stoppages and intervals: ${b.elapsedMinutes.toFixed(1)} minutes.`, '',
    'Experimental calibration result; no standings, development, injuries, or fatigue are carried forward.', '',
    '| Quarter | Points in quarter | Cumulative score | Playing minutes |', '|---|---:|---:|---:|',
    ...result.quarters.map(q => `| ${q.quarter} | ${q.points.join('–')} | ${q.cumulative.join('–')} | ${(q.playingSeconds / 60).toFixed(1)} |`), '',
    `Winning play: ${b.winningPlay.player}, central four-point kick, ${b.winningPlay.awardedPoints} official points ` +
      `(event ${b.winningPlay.eventId}). Lead changes: ${b.leadChanges}; largest lead: ${b.largestLead}.`, '',
    '| Statistic | ' + names.join(' | ') + ' |', '|---|---:|---:|'];
  for (const stat of ['points', 'centralAirScores', 'centralBounceScores', 'outerAirScores', 'outerDeflectedScores',
    'bonusesEarned', 'bonusesConverted', 'shots', 'kicks', 'handPunches', 'completedPasses', 'carries',
    'catches', 'ballUpsWon', 'recoveries', 'interceptions', 'spoils', 'tackles', 'turnovers', 'fouls', 'penalties', 'transitionShots']) {
    lines.push(`| ${stat} | ${result.teamStats.map(t => t[stat] ?? 0).join(' | ')} |`);
  }
  for (const side of [0, 1] as const) {
    lines.push('', `## ${names[side]} — player statistics`, '',
      '| Player | Minutes | Points | Shots | Kicks | Hand-punches | Catches | Tackles | Recoveries |',
      '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const p of result.players.filter(p => p.side === side).sort((a, c) => (c.stats.points ?? 0) - (a.stats.points ?? 0))) {
      lines.push(`| ${p.name} | ${(p.secondsPlayed / 60).toFixed(1)} | ` +
        ['points', 'shots', 'kicks', 'handPunches', 'catches', 'tackles', 'recoveries'].map(s => p.stats[s] ?? 0).join(' | ') + ' |');
    }
  }
  lines.push('', '## Incidents', '', ...b.noteworthy.map(e => `- Q${e.quarter}, ${(e.playingSeconds / 60).toFixed(1)} playing minutes: ${e.type}, ${e.player} (${e.team}); event ${e.eventId}.`));
  return lines.join('\n') + '\n';
}
