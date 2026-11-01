import type { MatchInput, MatchEvent, PlayerStats, Side } from './types.js';

/** Replay the event ledger. Box scores are never generated independently of match events. */
export function projectStatistics(input: MatchInput, events: MatchEvent[]) {
  const players: PlayerStats[] = input.teams.flatMap((team, s) => team.players.map(p => ({
    id: p.id, name: p.name, side: s as Side, secondsPlayed: 0, stats: {}
  })));
  const byId = new Map(players.map(p => [p.id, p]));
  const active = new Set<string>();
  const teamStats: [Record<string, number>, Record<string, number>] = [
    { points: 0, shots: 0, possessionSeconds: 0, playerSeconds: 0, shortHandedSeconds: 0 },
    { points: 0, shots: 0, possessionSeconds: 0, playerSeconds: 0, shortHandedSeconds: 0 }
  ];
  for (const e of events) {
    if (e.type === 'lineup') for (const id of e.data!.playerIds as string[]) active.add(id);
    if (e.type === 'substitution') {
      if (e.otherPlayerId) active.delete(e.otherPlayerId);
      active.add(e.playerId!);
    }
    if (e.type === 'injury' || e.type === 'penalty_start') active.delete(e.playerId!);
    if (e.type === 'penalty_end' && e.data?.returns) active.add(e.playerId!);
    if (e.type === 'time' && e.data?.mode === 'playing') {
      const seconds = Number(e.data.seconds);
      for (const id of active) byId.get(id)!.secondsPlayed += seconds;
      if (e.side !== undefined) teamStats[e.side].possessionSeconds = (teamStats[e.side].possessionSeconds ?? 0) + seconds;
      for (const side of [0, 1] as const) {
        const count = [...active].filter(id => byId.get(id)!.side === side).length;
        teamStats[side].playerSeconds = (teamStats[side].playerSeconds ?? 0) + count * seconds;
        if (count < 15) teamStats[side].shortHandedSeconds = (teamStats[side].shortHandedSeconds ?? 0) + seconds;
      }
    }
    for (const c of e.credits ?? []) {
      const p = byId.get(c.playerId);
      if (!p) throw new Error(`Credit to unknown player: ${c.playerId}`);
      p.stats[c.stat] = (p.stats[c.stat] ?? 0) + (c.amount ?? 1);
      teamStats[p.side][c.stat] = (teamStats[p.side][c.stat] ?? 0) + (c.amount ?? 1);
    }
    if (e.type === 'shot' && e.data?.transition && e.side !== undefined) {
      teamStats[e.side].transitionShots = (teamStats[e.side].transitionShots ?? 0) + 1;
    }
  }
  return { players, teamStats };
}
