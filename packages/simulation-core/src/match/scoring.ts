import type { ScoreState, ScoreResolution, ScoringKind, Side } from './types.js';

/** Pure transition: all caps, bonus ownership, and finishing rules live here. */
export function resolveScore(previous: ScoreState, side: Side, playerId: string,
  kind: ScoringKind, eventId: number): ScoreResolution {
  if (previous.winner !== null) throw new Error('Cannot score after the match ends');
  const state: ScoreState = {
    scores: [...previous.scores], bonuses: [previous.bonuses[0].map(b => ({ ...b })),
      previous.bonuses[1].map(b => ({ ...b }))], winner: null
  };
  const result: ScoreResolution = { kind, nominalPoints: 0, awardedPoints: 0, credits: [],
    bonusesConverted: 0, bonusesLost: 0, pointsCapped: 0, winning: false, state };
  // A bonus adds a pending claim; another bonus stacks instead of converting it.
  if (kind === 'bonus') {
    state.bonuses[side].push({ playerId, eventId });
    return result;
  }
  const nominal = kind === 'central_air' ? 4 : kind === 'central_bounce' || kind === 'outer_deflection' ? 2 : 1;
  const cap = kind === 'central_air' ? 100 : 99;
  let room = Math.max(0, cap - state.scores[side]);
  const kickPoints = Math.min(nominal, room);
  result.credits.push({ playerId, points: kickPoints, source: 'kick' });
  room -= kickPoints;
  result.nominalPoints = nominal + state.bonuses[side].length;
  result.bonusesConverted = state.bonuses[side].length;
  for (const bonus of state.bonuses[side]) {
    const points = Math.min(1, room);
    result.credits.push({ playerId: bonus.playerId, points, source: 'bonus' });
    room -= points;
  }
  result.bonusesLost = state.bonuses[(1 - side) as Side].length;
  state.bonuses = [[], []];
  result.awardedPoints = result.credits.reduce((n, c) => n + c.points, 0);
  result.pointsCapped = result.nominalPoints - result.awardedPoints;
  state.scores[side] += result.awardedPoints;
  result.winning = kind === 'central_air' && state.scores[side] === 100;
  if (result.winning) state.winner = side;
  return result;
}
