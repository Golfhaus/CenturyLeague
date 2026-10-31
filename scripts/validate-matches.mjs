import assert from 'node:assert/strict';
import { ATTRIBUTE_KEYS, simulateMatch, resolveScore, projectStatistics, createRandom, matchBriefing,
  validateMatchInput, DEFAULT_MATCH_CONFIG } from '../packages/simulation-core/dist/index.js';

let checks = 0;
const state = (a = 0, b = 0, bonuses = [[], []]) => ({ scores: [a, b], bonuses, winner: null });
for (let score = 0; score < 100; score++) {
  for (const kind of ['central_air', 'central_bounce', 'outer_air', 'outer_deflection', 'bonus']) {
    const previous = state(score, 99);
    const before = JSON.stringify(previous);
    const r = resolveScore(previous, 0, 'a', kind, 1);
    assert.equal(JSON.stringify(previous), before);
    assert.ok(r.state.scores[0] <= 100);
    assert.equal(r.winning, kind === 'central_air' && score >= 96);
    if (kind !== 'central_air') assert.ok(r.state.scores[0] <= 99);
    assert.equal(r.credits.reduce((n, c) => n + c.points, 0), r.awardedPoints);
    checks++;
  }
}
assert.equal(resolveScore(state(97), 0, 'a', 'central_air', 1).awardedPoints, 3);
assert.equal(resolveScore(state(99), 0, 'a', 'central_air', 1).awardedPoints, 1);
let s = resolveScore(state(), 0, 'a', 'bonus', 1).state;
s = resolveScore(s, 0, 'b', 'bonus', 2).state;
assert.equal(s.bonuses[0].length, 2);
let bonus = resolveScore(s, 0, 'c', 'outer_air', 3);
assert.equal(bonus.awardedPoints, 3);
assert.deepEqual(bonus.credits.map(c => c.playerId), ['c', 'a', 'b']);
assert.equal(resolveScore(s, 1, 'd', 'outer_air', 4).bonusesLost, 2);
bonus = resolveScore(state(94, 70, [[{ playerId: 'a', eventId: 1 }, { playerId: 'b', eventId: 2 }], []]), 0, 'c', 'central_air', 3);
assert.equal(bonus.winning, true);
assert.equal(bonus.state.scores[0], 100);
assert.throws(() => resolveScore(bonus.state, 1, 'd', 'outer_air', 4));
const capped = resolveScore(state(98, 80, [[{ playerId: 'a', eventId: 1 }], []]), 0, 'b', 'central_bounce', 2);
assert.equal(capped.state.scores[0], 99);
assert.equal(capped.pointsCapped, 2);

const rng = createRandom('match-test-population');
function team(id, boost = 0) {
  return { id, name: id, coach: { name: 'Test Coach', tactics: {
    tempo: 3, physicality: 3, defensive_posture: 3, pressure: 3, transition_emphasis: 3,
    width: 3, aerial_emphasis: 3, ball_risk: 3, running_movement_emphasis: 3, defensive_aggression: 3
  } }, players: Array.from({ length: 35 }, (_, i) => ({ id: `${id}-${i}`, name: `${id} Player ${i}`,
    ratings: Object.fromEntries(ATTRIBUTE_KEYS.map(k => [k, Math.max(1, Math.min(20, 11 + boost + rng.normal(0, 1.5)))])) })) };
}
const base = { id: 'unit-exhibition', seed: 'replay', teams: [team('A'), team('B')] };
function audit(result) {
  assert.equal(result.scores[result.winner], 100);
  assert.ok(result.scores[1 - result.winner] < 100);
  assert.equal(result.quarters.length, 4);
  for (let i = 0; i < 3; i++) assert.ok(Math.max(...result.quarters[i].cumulative) >= 25 * (i + 1));
  for (const side of [0, 1]) {
    assert.equal(result.players.filter(p => p.side === side).reduce((n, p) => n + (p.stats.points ?? 0), 0), result.scores[side]);
    assert.equal(result.teamStats[side].points, result.scores[side]);
    assert.equal(result.quarters.reduce((n, q) => n + q.points[side], 0), result.scores[side]);
    assert.ok(Math.abs(result.players.filter(p => p.side === side).reduce((n, p) => n + p.secondsPlayed, 0) - result.teamStats[side].playerSeconds) < 1e-5);
  }
  assert.deepEqual(projectStatistics(result.input, result.events), { players: result.players, teamStats: result.teamStats });
  const active = [new Set(), new Set()];
  const penalized = new Map();
  const injured = new Set();
  const byId = new Map(result.players.map(p => [p.id, p]));
  let lastPlaying = 0;
  let lastElapsed = 0;
  const actionTypes = new Set(['ball_up', 'shot', 'kick', 'hand_punch', 'carry', 'catch', 'receive', 'intercept_catch',
    'interception', 'aerial_spoil', 'ground_recovery', 'tackle_complete', 'tackle_dislodged', 'foul', 'free_kick', 'bounce', 'kick_back', 'ball_in']);
  for (const e of result.events) {
    assert.ok(e.playingSeconds >= lastPlaying && e.elapsedSeconds >= lastElapsed);
    lastPlaying = e.playingSeconds; lastElapsed = e.elapsedSeconds;
    if (e.type === 'lineup') for (const id of e.data.playerIds) active[e.side].add(id);
    if (actionTypes.has(e.type)) {
      assert.ok(active[e.side].has(e.playerId), `${e.type}: off-field actor ${e.playerId}, event ${e.id}`);
    }
    if (e.type === 'substitution') {
      assert.ok(!active[e.side].has(e.playerId), 'incoming player already active');
      assert.ok(!injured.has(e.playerId) && !penalized.has(e.playerId));
      if (e.otherPlayerId) assert.ok(active[e.side].delete(e.otherPlayerId));
      active[e.side].add(e.playerId);
    }
    if (e.type === 'injury') { active[e.side].delete(e.playerId); injured.add(e.playerId); }
    if (e.type === 'penalty_start') {
      assert.ok(active[e.side].delete(e.playerId));
      penalized.set(e.playerId, e.data.expiresAtPlayingSeconds);
    }
    if (e.type === 'penalty_end') {
      assert.ok(Math.abs(penalized.get(e.playerId) - e.playingSeconds) < 1e-5, 'penalty did not serve full playing time');
      penalized.delete(e.playerId);
      if (e.data.returns) active[e.side].add(e.playerId);
    }
    assert.ok(active[0].size <= 15 && active[1].size <= 15, `too many on field at event ${e.id}`);
    for (const credit of e.credits ?? []) assert.ok(byId.has(credit.playerId));
  }
  const winning = result.events.filter(e => e.type === 'score' && e.data.winning);
  assert.equal(winning.length, 1);
  assert.equal(winning[0].data.kind, 'central_air');
  assert.equal(result.events.filter(e => e.type === 'score').at(-1).id, winning[0].id);
  assert.ok(result.players.every(p => p.secondsPlayed >= 0 && p.secondsPlayed <= result.playingSeconds + 1e-6));
  assert.equal(matchBriefing(result).winningPlay.eventId, winning[0].id);
  checks++;
}
const before = JSON.stringify(base);
const replay = simulateMatch(base);
audit(replay);
assert.equal(JSON.stringify(base), before, 'simulation changed input ratings/rosters');
assert.deepEqual(simulateMatch(base), replay, 'seed/input/version should reproduce every event');
assert.equal(JSON.stringify(simulateMatch(JSON.parse(before))), JSON.stringify(replay),
  'replay must also survive a saved JSON round trip');
assert.notDeepEqual(simulateMatch({ ...base, seed: 'another' }).scores, undefined);
assert.throws(() => simulateMatch({ ...base, config: { maxEvents: 100 } }), /safety limit/);
assert.throws(() => validateMatchInput({ ...base, config: { onField: 16 } }));
assert.throws(() => validateMatchInput({ ...base, config: { fatiguePerSecond: NaN } }));
assert.throws(() => validateMatchInput({ ...base, teams: [base.teams[0], base.teams[0]] }));
const bad = structuredClone(base); bad.teams[0].players[0].ratings.speed = 21;
assert.throws(() => validateMatchInput(bad));
let penaltyEvents = 0;
let injuryEvents = 0;
for (let i = 0; i < 24; i++) {
  const r = simulateMatch({ ...base, id: `stress-${i}`, seed: `stress-${i}`, config: {
    injuryChancePerContest: 0.012, standardPenaltySeconds: i % 2 ? 60 : 180, seriousPenaltySeconds: 300
  } });
  audit(r);
  penaltyEvents += r.events.filter(e => e.type === 'penalty_start').length;
  injuryEvents += r.events.filter(e => e.type === 'injury').length;
}
assert.ok(penaltyEvents > 0 && injuryEvents > 0, 'stress batch must exercise both penalties and injuries');
// A large genuine ability difference must matter across seeds, without prescribing individual winners.
const strong = team('Strong', 5); const weak = team('Weak', -3);
let strongWins = 0;
for (let i = 0; i < 12; i++) {
  const order = i % 2 ? [weak, strong] : [strong, weak];
  const r = simulateMatch({ id: `quality-${i}`, seed: `quality-${i}`, teams: order });
  audit(r); strongWins += order[r.winner].id === 'Strong' ? 1 : 0;
}
assert.ok(strongWins >= 10, 'large underlying attribute advantages must affect results');
console.log(JSON.stringify({ checks, stressMatches: 24, strongWins, penaltyEvents, injuryEvents,
  defaultMinimumPlayers: DEFAULT_MATCH_CONFIG.minimumPlayers, status: 'passed' }));
