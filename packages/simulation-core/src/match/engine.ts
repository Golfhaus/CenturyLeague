import { createRandom, clamp, weightedChoice } from '../random.js';
import type { AttributeKey } from '../types.js';
import { calculateRoleRatings } from '../roleRatings.js';
import { validateMatchInput } from './input.js';
import { resolveScore } from './scoring.js';
import { projectStatistics } from './statistics.js';
import type { MatchConfig, MatchInput, MatchEvent, MatchPlayer, MatchResult,
  Side, ScoreState, ScoringKind, StatCredit, QuarterResult } from './types.js';

export const MATCH_ENGINE_VERSION = '0.1.0-exhibition';
type Player = MatchPlayer & { side: Side; x: number; y: number; energy: number;
  stint: number; available: boolean; on: boolean; penaltyUntil: number | null };
interface Penalty { side: Side; playerId: string; duration: number }
interface Advantage { side: Side; playerId: string; x: number; y: number; scoreAllowed: boolean }
const other = (side: Side): Side => side === 0 ? 1 : 0;

/** Event simulation with broad spatial movement, not a frame-by-frame physics model. */
export function simulateMatch(input: MatchInput): MatchResult {
  return new ExhibitionMatch(input).run();
}

class ExhibitionMatch {
  private readonly config: MatchConfig;
  private readonly rng;
  private readonly players: Player[];
  private readonly events: MatchEvent[] = [];
  private readonly quarters: QuarterResult[] = [];
  private score: ScoreState = { scores: [0, 0], bonuses: [[], []], winner: null };
  private playing = 0;
  private elapsed = 0;
  private quarter = 1;
  private quarterStart = { playing: 0, elapsed: 0, scores: [0, 0] };
  private ball = { x: 75, y: 47.5 };
  private carrier: Player | null = null;
  private freeMovement = false;
  private noDirectScore = false;
  private lastTurnoverAt = -1000;
  private pending: Penalty[] = [];
  private advantage: Advantage | null = null;
  private lastReview = 0;
  private exchanges = new Map<string, string>();

  constructor(private readonly input: MatchInput) {
    this.config = validateMatchInput(input);
    this.rng = createRandom(`${MATCH_ENGINE_VERSION}:${input.seed}`);
    this.ball = { x: this.config.fieldLength / 2, y: this.config.fieldWidth / 2 };
    this.players = input.teams.flatMap((team, s) => team.players.map(p => ({
      ...p, ratings: { ...p.ratings }, side: s as Side, x: this.ball.x, y: this.ball.y,
      energy: 1, stint: 0, available: true, on: false, penaltyUntil: null
    })));
  }

  private emit(type: string, fields: Partial<MatchEvent> = {}): MatchEvent {
    const event: MatchEvent = { ...fields, id: this.events.length + 1, type, quarter: this.quarter,
      playingSeconds: this.playing, elapsedSeconds: this.elapsed };
    this.events.push(event);
    return event;
  }
  private on(side: Side): Player[] { return this.players.filter(p => p.side === side && p.on); }
  private tactic(side: Side, key: keyof MatchInput['teams'][0]['coach']['tactics']): number {
    return this.input.teams[side].coach.tactics[key];
  }
  private dir(side: Side): number { return side === 0 ? 1 : -1; }
  private progress(side: Side): number {
    return side === 0 ? this.ball.x : this.config.fieldLength - this.ball.x;
  }
  private skill(p: Player, keys: AttributeKey[]): number {
    const raw = keys.reduce((n, k) => n + p.ratings[k], 0) / keys.length;
    return raw * (0.64 + 0.36 * p.energy);
  }
  private distance(p: { x: number; y: number }, q = this.ball): number {
    return Math.hypot(p.x - q.x, p.y - q.y);
  }
  private pick(list: Player[], keys: AttributeKey[], at = this.ball): Player {
    if (!list.length) throw new Error('No eligible participant');
    const settled = list.filter(p => !this.exchanges.has(p.id));
    const chosen = weightedChoice(this.rng, (settled.length ? settled : list).map(p => ({ value: p,
      weight: Math.exp((this.skill(p, keys) - 10) / 4) / (1 + this.distance(p, at) / 9) ** 2 })));
    this.exchanges.delete(chosen.id);
    return chosen;
  }
  private chance(a: number, b: number, base = 0): boolean {
    return this.rng.next() < 1 / (1 + Math.exp(-((a - b) / 3.4 + base)));
  }
  private duration(base: number, side: Side): number {
    return Math.max(1, base * (1.3 - this.tactic(side, 'tempo') * 0.1) * (0.75 + this.rng.next() * 0.5));
  }
  private phaseMovement(seconds: number): void {
    const possessing = this.carrier?.side;
    for (const p of this.players.filter(p => p.on && p !== this.carrier)) {
      const r = calculateRoleRatings(p.ratings);
      // Continuous ability-based supporting depth, recomputed every event; no position assignment.
      const bias = clamp((r.attackingRating - r.defensiveRating) / 3, -1, 1);
      const counter = this.playing - this.lastTurnoverAt < 20 ? this.tactic(p.side, 'transition_emphasis') - 3 : 0;
      const possessionOffset = possessing === p.side ? 9 + counter * 4 : -8;
      const posture = (this.tactic(p.side, 'defensive_posture') - 3) * 3;
      let tx = clamp(this.ball.x + this.dir(p.side) * (bias * 24 + possessionOffset + posture),
        5, this.config.fieldLength - 5);
      const width = 5 + this.tactic(p.side, 'width') * 5;
      let ty = clamp(this.ball.y + this.rng.normal(0, width), 2, this.config.fieldWidth - 2);
      if (this.exchanges.has(p.id)) { tx = this.config.fieldLength / 2; ty = 0; }
      const d = Math.hypot(tx - p.x, ty - p.y);
      const pace = (1.3 + p.ratings.speed / 7) * (0.6 + 0.4 * p.energy);
      const movement = Math.min(d, pace * seconds);
      if (d > 0) { p.x += (tx - p.x) * movement / d; p.y += (ty - p.y) * movement / d; }
    }
  }
  private tick(seconds: number, mode: 'playing' | 'stoppage' | 'interval'): void {
    let remaining = seconds;
    while (remaining > 1e-7) {
      const nextExpiry = mode === 'playing' ? Math.min(...this.players
        .filter(p => p.penaltyUntil !== null && p.penaltyUntil > this.playing + 1e-7)
        .map(p => p.penaltyUntil! - this.playing), remaining) : remaining;
      const step = Math.min(remaining, nextExpiry);
      this.emit('time', { side: this.carrier?.side, data: { seconds: step, mode } });
      for (const p of this.players) {
        if (mode === 'playing' && p.on) {
          const effort = 0.85 + this.tactic(p.side, 'pressure') * 0.07 +
            this.tactic(p.side, 'running_movement_emphasis') * 0.035 + this.tactic(p.side, 'physicality') * 0.02;
          p.energy = clamp(p.energy - step * this.config.fatiguePerSecond * effort *
            (1.5 - p.ratings.stamina / 25), 0.15, 1);
          p.stint += step;
        } else {
          const multiplier = mode === 'interval' ? 0.65 : p.on ? 0.18 : 1;
          p.energy = clamp(p.energy + step * this.config.benchRecoveryPerSecond *
            (0.6 + p.ratings.recovery / 20) * multiplier, 0.15, 1);
        }
      }
      this.elapsed += step;
      if (mode === 'playing') {
        this.playing += step;
        this.phaseMovement(step);
        for (const p of this.players) {
          if (p.penaltyUntil !== null && p.penaltyUntil <= this.playing + 1e-7) {
            p.penaltyUntil = null;
            if (p.available) {
              p.on = true; p.stint = 0; p.x = this.config.fieldLength / 2; p.y = 0;
            }
            this.emit('penalty_end', { side: p.side, playerId: p.id, data: { returns: p.available } });
          }
        }
        this.completeExchanges();
      }
      remaining -= step;
    }
  }
  private action(type: string, player: Player, seconds: number,
    fields: Partial<MatchEvent> = {}, credits: StatCredit[] = []): void {
    this.tick(seconds, 'playing');
    this.emit(type, { side: player.side, playerId: player.id, x: this.ball.x, y: this.ball.y,
      ...fields, credits: [...credits, ...(fields.credits ?? [])] });
  }
  private lineup(): void {
    for (const side of [0, 1] as const) {
      const remaining = this.players.filter(p => p.side === side);
      const selected: Player[] = [];
      // Initial coverage only; these roles are not retained as player positions.
      for (const role of ['defensiveRating', 'centralRating', 'attackingRating'] as const) {
        for (let n = 0; n < 5; n++) {
          remaining.sort((a, b) => calculateRoleRatings(b.ratings)[role] - calculateRoleRatings(a.ratings)[role]);
          selected.push(remaining.shift()!);
        }
      }
      selected.forEach((p, i) => {
        p.on = true;
        p.x = side === 0 ? this.config.fieldLength * (0.24 + Math.floor(i / 5) * 0.23)
          : this.config.fieldLength * (0.76 - Math.floor(i / 5) * 0.23);
        p.y = this.config.fieldWidth * ((i % 5 + 1) / 6);
      });
      this.emit('lineup', { side, data: { playerIds: selected.map(p => p.id) } });
    }
  }
  private reviewSubstitutions(force = false): void {
    if (!force && this.playing - this.lastReview < this.config.substitutionReviewSeconds) return;
    this.lastReview = this.playing;
    for (const side of [0, 1] as const) {
      const activePenalties = this.players.filter(p => p.side === side && p.penaltyUntil !== null).length;
      const allowed = 15 - activePenalties;
      const reserved = new Set(this.exchanges.values());
      const bench = this.players.filter(p => p.side === side && !p.on && p.available && p.penaltyUntil === null && !reserved.has(p.id));
      const candidates = this.on(side).filter(p => p !== this.carrier && !this.exchanges.has(p.id) && !this.pending.some(q => q.playerId === p.id));
      const evaluation = (p: Player) => {
        const r = calculateRoleRatings(p.ratings);
        const attacking = this.progress(side) / this.config.fieldLength;
        const relevant = r.defensiveRating * (1 - attacking) + r.attackingRating * attacking;
        return (relevant * 0.55 + r.centralRating * 0.45) * (0.45 + 0.55 * p.energy);
      };
      candidates.sort((a, b) => evaluation(a) - evaluation(b));
      let exchanges = 0;
      while (bench.length && (this.on(side).length < allowed || (exchanges < 3 && candidates.length))) {
        bench.sort((a, b) => evaluation(b) - evaluation(a));
        const incoming = bench[0];
        const outgoing = this.on(side).length < allowed ? undefined : candidates[0];
        if (outgoing && (incoming.energy < 0.82 || outgoing.stint < 90 ||
            evaluation(incoming) < evaluation(outgoing) + (force ? 0.1 : 0.45))) break;
        bench.shift();
        if (outgoing) {
          candidates.shift();
          if (!force) {
            this.exchanges.set(outgoing.id, incoming.id);
            this.emit('substitution_requested', { side, playerId: incoming.id, otherPlayerId: outgoing.id,
              data: { gateX: this.config.fieldLength / 2, gateY: 0 } });
            exchanges++; continue;
          }
          outgoing.on = false; this.exchanges.delete(outgoing.id);
        }
        incoming.on = true; incoming.stint = 0;
        incoming.x = this.config.fieldLength / 2; incoming.y = 0;
        this.emit('substitution', { side, playerId: incoming.id, otherPlayerId: outgoing?.id,
          data: { authorized: true, incomingEnergy: incoming.energy, outgoingEnergy: outgoing?.energy,
            duringIntervalOrInjuryStoppage: true },
          credits: [{ playerId: incoming.id, stat: 'entries' }] });
        exchanges++;
      }
    }
  }
  private completeExchanges(): void {
    for (const [outId, inId] of this.exchanges) {
      const outgoing = this.players.find(p => p.id === outId)!;
      const incoming = this.players.find(p => p.id === inId)!;
      if (!outgoing.on || !outgoing.available || !incoming.available || incoming.on) {
        this.exchanges.delete(outId); continue;
      }
      if (outgoing === this.carrier || this.distance(outgoing, { x: this.config.fieldLength / 2, y: 0 }) > 1) continue;
      outgoing.on = false; incoming.on = true; incoming.stint = 0;
      incoming.x = this.config.fieldLength / 2; incoming.y = 0;
      this.exchanges.delete(outId);
      this.emit('substitution', { side: incoming.side, playerId: incoming.id, otherPlayerId: outgoing.id,
        data: { authorized: true, incomingEnergy: incoming.energy, outgoingEnergy: outgoing.energy,
          outgoingAtGate: true }, credits: [{ playerId: incoming.id, stat: 'entries' }] });
    }
  }
  private startPenalties(): void {
    // Advantage may persist through neutral contests; its delayed penalties
    // cannot start until the advantage has ended or a point score stands.
    if (this.advantage) return;
    const waiting: Penalty[] = [];
    for (const penalty of this.pending) {
      const p = this.players.find(x => x.id === penalty.playerId)!;
      if (this.on(p.side).length <= this.config.minimumPlayers || !p.on) { waiting.push(penalty); continue; }
      p.on = false; p.penaltyUntil = this.playing + penalty.duration;
      this.emit('penalty_start', { side: p.side, playerId: p.id,
        data: { durationSeconds: penalty.duration, expiresAtPlayingSeconds: p.penaltyUntil },
        credits: [{ playerId: p.id, stat: 'penalties' }] });
    }
    this.pending = waiting;
  }
  private ballUp(center = false): void {
    this.carrier = null; this.freeMovement = false; this.noDirectScore = false;
    if (center) this.ball = { x: this.config.fieldLength / 2, y: this.config.fieldWidth / 2 };
    this.tick(center ? 22 : 9, 'stoppage');
    this.startPenalties();
    this.reviewSubstitutions();
    const a = this.pick(this.on(0), ['verticalLeap', 'strength', 'contestedPossession']);
    const b = this.pick(this.on(1), ['verticalLeap', 'strength', 'contestedPossession']);
    const winner = this.chance(this.skill(a, ['verticalLeap', 'strength', 'contestedPossession']),
      this.skill(b, ['verticalLeap', 'strength', 'contestedPossession'])) ? a : b;
    this.action('ball_up', winner, 3, { otherPlayerId: winner === a ? b.id : a.id,
      data: { center }, credits: [{ playerId: winner.id, stat: 'ballUpsWon' }] });
    if (this.advantage && winner.side !== this.advantage.side) { this.enforceAdvantage(); return; }
    this.carrier = winner;
    winner.x = this.ball.x; winner.y = this.ball.y;
  }
  private possession(p: Player, protectedCatch = false): void {
    if (this.advantage && p.side !== this.advantage.side) { this.enforceAdvantage(); return; }
    if (this.carrier && this.carrier.side !== p.side) this.lastTurnoverAt = this.playing;
    this.carrier = p; this.freeMovement = protectedCatch;
    this.exchanges.delete(p.id);
    p.x = this.ball.x; p.y = this.ball.y;
  }
  private looseBall(): void {
    const a = this.pick(this.on(0), ['groundBallSkill', 'contestedPossession', 'anticipation']);
    const b = this.pick(this.on(1), ['groundBallSkill', 'contestedPossession', 'anticipation']);
    const winner = this.chance(this.skill(a, ['groundBallSkill', 'contestedPossession']),
      this.skill(b, ['groundBallSkill', 'contestedPossession'])) ? a : b;
    const previous = this.carrier;
    this.action('ground_recovery', winner, 3, { otherPlayerId: winner === a ? b.id : a.id,
      credits: [{ playerId: winner.id, stat: 'recoveries' },
        ...(previous && previous.side !== winner.side ? [{ playerId: previous.id, stat: 'turnovers' }] : [])] });
    this.noDirectScore = false;
    this.possession(winner);
  }
  private injury(p: Player): void {
    const risk = this.config.injuryChancePerContest * (1.5 - p.ratings.durability / 25) * (1.4 - p.energy * 0.4);
    if (!p.on || this.rng.next() >= risk) return;
    p.available = false; p.on = false;
    this.emit('injury', { side: p.side, playerId: p.id,
      data: { availability: 'out_for_this_match', persistsAfterMatch: false },
      credits: [{ playerId: p.id, stat: 'injuries' }] });
    if (this.carrier === p) this.carrier = null;
    this.tick(20, 'stoppage');
    this.reviewSubstitutions(true);
  }
  private foul(offender: Player, victim: Player, scoreAllowed: boolean): void {
    const serious = this.rng.next() < 0.09;
    const duration = serious ? this.config.seriousPenaltySeconds : this.config.standardPenaltySeconds;
    const shortHanded = serious || this.rng.next() < 0.13;
    if (shortHanded && !this.pending.some(p => p.playerId === offender.id)) {
      this.pending.push({ side: offender.side, playerId: offender.id, duration });
    }
    this.action('foul', offender, 1, { otherPlayerId: victim.id,
      data: { serious, shortHanded, durationSeconds: shortHanded ? duration : 0, scoreAllowed: serious || scoreAllowed },
      credits: [{ playerId: offender.id, stat: 'fouls' }, { playerId: victim.id, stat: 'freeKicksWon' }] });
    if (!this.advantage && this.carrier === victim && this.progress(victim.side) > this.config.fieldLength * 0.45 && this.rng.next() < 0.6) {
      this.advantage = { side: victim.side, playerId: victim.id, ...this.ball, scoreAllowed: serious || scoreAllowed };
      this.emit('advantage', { side: victim.side, playerId: victim.id });
      return;
    }
    this.freeKick(victim, serious || scoreAllowed);
  }
  private freeKick(player: Player, scoreAllowed: boolean): void {
    this.tick(9, 'stoppage');
    // Assessed penalties start at the next ball-up, not at this free kick.
    this.carrier = player; this.freeMovement = true; this.noDirectScore = !scoreAllowed;
    player.x = this.ball.x; player.y = this.ball.y;
    this.emit('free_kick', { side: player.side, playerId: player.id, ...this.ball, data: { scoreAllowed } });
  }
  private enforceAdvantage(): void {
    const advantage = this.advantage!;
    this.advantage = null;
    this.ball = { x: advantage.x, y: advantage.y };
    const taker = this.players.find(p => p.id === advantage.playerId && p.on) ??
      this.pick(this.on(advantage.side), ['kickingAccuracy', 'decisionMaking']);
    this.emit('advantage_recalled', { side: advantage.side, playerId: taker.id });
    this.freeKick(taker, advantage.scoreAllowed);
  }
  private scored(p: Player, kind: ScoringKind, deflected = false): void {
    const resolution = resolveScore(this.score, p.side, p.id, kind, this.events.length + 1);
    this.score = resolution.state;
    const category = kind === 'central_air' ? 'centralAirScores' : kind === 'central_bounce'
      ? 'centralBounceScores' : kind === 'outer_air' ? 'outerAirScores' : kind === 'outer_deflection'
        ? 'outerDeflectedScores' : 'bonusesEarned';
    this.emit('score', { side: p.side, playerId: p.id, ...this.ball,
      data: { kind, deflected, nominalPoints: resolution.nominalPoints,
        awardedPoints: resolution.awardedPoints, pointsCapped: resolution.pointsCapped,
        bonusesConverted: resolution.bonusesConverted, bonusesLost: resolution.bonusesLost,
        scores: [...this.score.scores], winning: resolution.winning,
        bonusCredits: resolution.credits.filter(c => c.source === 'bonus') },
      credits: [{ playerId: p.id, stat: category },
        ...resolution.credits.map(c => ({ playerId: c.playerId, stat: 'points', amount: c.points })),
        ...resolution.credits.filter(c => c.source === 'bonus').map(c => ({ playerId: c.playerId, stat: 'bonusesConverted' }))] });
    if (kind === 'bonus') { this.ballUp(true); return; }
    const delayed = this.advantage;
    this.advantage = null;
    if (this.score.winner !== null) { this.finishQuarter(); return; }
    if (Math.max(...this.score.scores) >= this.quarter * 25 && this.quarter < 4) {
      this.finishQuarter();
      this.tick(this.config.intervalSeconds[this.quarter - 1], 'interval');
      this.quarter++;
      this.quarterStart = { playing: this.playing, elapsed: this.elapsed, scores: [...this.score.scores] };
      this.reviewSubstitutions(true);
    }
    if (delayed && this.rng.next() < 0.65) {
      // Optional restart after scoring during advantage. No kick-back can score.
      this.carrier = null; this.ball = { x: this.config.fieldLength / 2, y: this.config.fieldWidth / 2 };
      this.tick(22, 'stoppage'); this.startPenalties(); this.reviewSubstitutions();
      const kicker = this.pick(this.on(other(p.side)), ['kickingPower', 'kickingAccuracy']);
      this.action('kick_back', kicker, 6, { data: { scoringPermitted: false, receivingSide: p.side } });
      this.ball.x += this.dir(other(p.side)) * 25;
      this.carrier = this.pick(this.on(p.side), ['aerialMarking', 'anticipation']);
      this.carrier.x = this.ball.x; this.carrier.y = this.ball.y;
      this.freeMovement = true; this.noDirectScore = false;
    } else this.ballUp(true);
  }
  private finishQuarter(): void {
    const row: QuarterResult = { quarter: this.quarter, cumulative: [...this.score.scores],
      points: [this.score.scores[0] - this.quarterStart.scores[0], this.score.scores[1] - this.quarterStart.scores[1]],
      playingSeconds: this.playing - this.quarterStart.playing,
      elapsedSeconds: this.elapsed - this.quarterStart.elapsed };
    this.quarters.push(row);
    this.emit('quarter_end', { data: { ...row } });
  }
  private shot(p: Player): void {
    const distance = this.config.fieldLength - this.progress(p.side);
    const goalY = this.config.fieldWidth * (p.side === 0 ? 0.36 : 0.64);
    const anglePenalty = Math.abs(this.ball.y - goalY) / this.config.fieldWidth;
    const protectedKick = this.freeMovement;
    const defender = this.pick(this.on(other(p.side)), ['defensiveSpoiling', 'anticipation']);
    const power = this.skill(p, ['kickingPower']);
    const accuracy = this.skill(p, protectedKick ? ['kickingAccuracy', 'composure', 'oppositeSideSkill']
      : ['kickingOnRun', 'composure', 'oppositeSideSkill']);
    this.action('shot', p, this.duration(protectedKick ? 11 : 5, p.side), {
      otherPlayerId: defender.id, data: { distance, protectedKick,
        transition: this.playing - this.lastTurnoverAt < 20 },
      credits: [{ playerId: p.id, stat: 'shots' }, { playerId: p.id, stat: 'kicks' }] });
    this.freeMovement = false;
    const blocked = this.distance(defender) < 18 && this.rng.next() <
      clamp(0.07 + (this.skill(defender, ['defensiveSpoiling', 'verticalLeap']) - power) * 0.012, 0.02, 0.25);
    if (blocked) {
      const deflectThrough = this.rng.next() < 0.24;
      this.emit('shot_deflection', { side: defender.side, playerId: defender.id, otherPlayerId: p.id,
        data: { control: false, groundContact: !deflectThrough },
        credits: [{ playerId: defender.id, stat: 'spoils' }] });
      if (deflectThrough) {
        // Rule 9.2.1: untouched ground + no control -> four central, two outer.
        this.scored(p, this.rng.next() < 0.7 ? 'central_air' : 'outer_deflection', true); return;
      }
      this.looseBall(); return;
    }
    const reaches = clamp(0.95 - Math.max(0, distance - (20 + power * 2)) * 0.02, 0.2, 0.98);
    if (this.rng.next() > reaches) { this.looseBall(); return; }
    const central = clamp(0.48 + (accuracy - 11) * 0.035 - distance * 0.003 - anglePenalty * 0.3,
      0.12, 0.78);
    const outer = 0.27;
    const bounce = this.rng.next() < clamp(0.11 + distance * 0.003 - power * 0.004, 0.05, 0.45);
    const roll = this.rng.next();
    if (roll < central) this.scored(p, bounce ? 'central_bounce' : 'central_air');
    else if (roll < central + outer) this.scored(p, bounce ? 'bonus' : 'outer_air');
    else this.ballIn(other(p.side), true);
  }
  private ballIn(side: Side, endLine = false): void {
    if (this.advantage) { this.enforceAdvantage(); return; }
    this.tick(9, 'stoppage');
    const taker = this.pick(this.on(side), ['awareness']);
    this.emit('ball_in', { side, playerId: taker.id, ...this.ball,
      data: { method: 'backward_overhead_throw', minimumFeet: 6, freeMovement: false, endLine } });
    this.ball.x = clamp(this.ball.x - this.dir(other(side)) * 6, 3, this.config.fieldLength - 3);
    this.ball.y = clamp(this.ball.y, 4, this.config.fieldWidth - 4);
    // The awarded team administers the throw; either team can win the live contest.
    this.carrier = null; this.freeMovement = false; this.looseBall();
  }
  private pass(p: Player, kick: boolean): void {
    const risk = this.tactic(p.side, 'ball_risk');
    const aerial = this.tactic(p.side, 'aerial_emphasis');
    const counter = this.playing - this.lastTurnoverAt < 20 ? (this.tactic(p.side, 'transition_emphasis') - 3) * 3 : 0;
    const advance = kick ? 16 + this.skill(p, ['kickingPower']) * 1.4 + (risk - 3) * 3 + counter
      : 6 + this.rng.next() * 10;
    const target = {
      x: clamp(this.ball.x + this.dir(p.side) * advance, 3, this.config.fieldLength - 3),
      y: clamp(this.ball.y + this.rng.normal(0, 3 + this.tactic(p.side, 'width') * 2.5), 2, this.config.fieldWidth - 2)
    };
    const receiver = this.pick(this.on(p.side).filter(q => q !== p),
      kick ? ['aerialMarking', 'anticipation'] : ['awareness', 'groundBallSkill'], target);
    const defender = this.pick(this.on(other(p.side)), ['anticipation', 'defensiveSpoiling'], target);
    const skill = this.skill(p, kick ? ['kickingAccuracy', 'decisionMaking', 'oppositeSideSkill']
      : ['handPassing', 'decisionMaking']);
    const defense = this.skill(defender, ['anticipation', 'defensiveSpoiling']);
    const accurate = this.chance(skill, defense, (kick ? 0.9 : 1.8) - (risk - 3) * 0.17);
    this.action(kick ? 'kick' : 'hand_punch', p, this.duration(kick ? 7 : 4, p.side), {
      otherPlayerId: receiver.id, data: { targetX: target.x, targetY: target.y, aerial: kick && aerial >= 3 },
      credits: [{ playerId: p.id, stat: kick ? 'kicks' : 'handPunches' }] });
    this.freeMovement = false;
    this.ball = target;
    this.noDirectScore = false; // another participant touches every resolved pass below
    if (!accurate && this.rng.next() < 0.12) { this.ballIn(other(p.side)); return; }
    const caught = kick && accurate && this.chance(this.skill(receiver, ['aerialMarking', 'verticalLeap', 'anticipation']),
      this.skill(defender, ['defensiveSpoiling', 'verticalLeap']), 0.6 + (aerial - 3) * 0.08);
    if (caught) {
      this.emit('catch', { side: p.side, playerId: receiver.id, otherPlayerId: defender.id, ...this.ball,
        data: { freeMovement: true }, credits: [{ playerId: receiver.id, stat: 'catches' },
          { playerId: p.id, stat: 'completedPasses' }] });
      this.possession(receiver, true);
    } else if (accurate && !kick) {
      this.emit('receive', { side: p.side, playerId: receiver.id, ...this.ball,
        credits: [{ playerId: p.id, stat: 'completedPasses' }] });
      this.possession(receiver);
    } else if (!accurate && this.rng.next() < 0.55) {
      this.emit(kick ? 'intercept_catch' : 'interception', { side: defender.side, playerId: defender.id,
        otherPlayerId: p.id, ...this.ball, data: { freeMovement: kick },
        credits: [{ playerId: defender.id, stat: 'interceptions' }, { playerId: p.id, stat: 'turnovers' },
          ...(kick ? [{ playerId: defender.id, stat: 'catches' }] : [])] });
      this.possession(defender, kick);
    } else {
      if (kick) this.emit('aerial_spoil', { side: defender.side, playerId: defender.id,
        otherPlayerId: receiver.id, ...this.ball, credits: [{ playerId: defender.id, stat: 'spoils' }] });
      this.looseBall();
    }
  }
  private carry(p: Player): void {
    // Running explicitly relinquishes the protected movement granted by a clean kick catch.
    this.freeMovement = false;
    const defender = this.pick(this.on(other(p.side)), ['tackling', 'acceleration', 'anticipation']);
    const seconds = this.duration(5, p.side);
    this.action('carry', p, seconds, { data: { protectedMovementEnded: true },
      credits: [{ playerId: p.id, stat: 'carries' }] });
    const pressure = this.tactic(defender.side, 'pressure');
    const challenge = this.tactic(defender.side, 'defensive_aggression');
    const contact = this.rng.next() < clamp(0.25 + pressure * 0.055 + challenge * 0.025 +
      (this.tactic(defender.side, 'physicality') - 3) * 0.015 -
      this.distance(defender) * 0.007, 0.08, 0.8);
    if (contact) {
      const foulRisk = 0.025 + Math.max(0, challenge - 3) * 0.013 +
        Math.max(0, 12 - defender.ratings.discipline) * 0.006;
      if (this.rng.next() < foulRisk) { this.foul(defender, p, this.progress(p.side) > this.config.fieldLength - 35); return; }
      const tackled = this.chance(this.skill(defender, ['tackling', 'strength', 'acceleration']),
        this.skill(p, ['evasion', 'agility', 'ballCarrying', 'strength']), 0.25);
      if (tackled) {
        const dislodged = this.rng.next() < 0.22;
        this.emit(dislodged ? 'tackle_dislodged' : 'tackle_complete', { side: defender.side,
          playerId: defender.id, otherPlayerId: p.id, ...this.ball,
          credits: [{ playerId: defender.id, stat: 'tackles' }, { playerId: p.id, stat: 'timesTackled' }] });
        if (dislodged) this.looseBall(); else this.ballUp();
        this.injury(p); this.injury(defender); return;
      }
      this.emit('evasion', { side: p.side, playerId: p.id, otherPlayerId: defender.id,
        credits: [{ playerId: p.id, stat: 'evasions' }] });
    }
    const distance = (1.2 + this.skill(p, ['speed', 'acceleration']) / 8) * seconds;
    const through = this.progress(p.side) + distance >= this.config.fieldLength;
    this.ball.x = clamp(this.ball.x + this.dir(p.side) * distance, 1, this.config.fieldLength - 1);
    p.x = this.ball.x; p.y = this.ball.y;
    this.emit('bounce', { side: p.side, playerId: p.id, credits: [{ playerId: p.id, stat: 'bounces' }] });
    if (through && !this.noDirectScore) {
      const goalY = this.config.fieldWidth * (p.side === 0 ? 0.36 : 0.64);
      const lateral = Math.abs(this.ball.y - goalY);
      if (lateral <= 6) { this.scored(p, 'central_bounce'); return; }
      if (lateral <= 12) { this.scored(p, 'bonus'); return; }
      this.ballIn(other(p.side), true); return;
    }
    if (this.rng.next() < Math.max(0.005, 0.06 - this.skill(p, ['ballCarrying', 'agility']) * 0.003)) this.looseBall();
  }
  run(): MatchResult {
    this.emit('match_start', { data: { engineVersion: MATCH_ENGINE_VERSION, seed: this.input.seed } });
    this.lineup(); this.ballUp(true);
    while (this.score.winner === null) {
      if (this.events.length > this.config.maxEvents || this.playing > this.config.maxPlayingSeconds) {
        throw new Error(`Exhibition ${this.input.id} exceeded safety limit; no result or forced winner recorded`);
      }
      this.reviewSubstitutions();
      if (!this.carrier || !this.carrier.on) { this.ballUp(); continue; }
      const p = this.carrier;
      const distance = this.config.fieldLength - this.progress(p.side);
      const decision = this.skill(p, ['decisionMaking', 'awareness']);
      const wantsShot = !this.noDirectScore && distance < 25 + this.skill(p, ['kickingPower']) * 2.4 &&
        this.rng.next() < clamp(0.7 - distance * 0.007 + (this.tactic(p.side, 'ball_risk') - 3) * 0.04 +
          (this.score.scores[p.side] >= 95 ? 0.14 : 0) + (decision - 11) * 0.01, 0.1, 0.92);
      if (wantsShot) { this.shot(p); continue; }
      const kickWeight = 2.5 + this.tactic(p.side, 'aerial_emphasis') * 0.65 +
        this.tactic(p.side, 'transition_emphasis') * 0.25;
      const choice = weightedChoice(this.rng, [
        { value: 'kick', weight: kickWeight },
        { value: 'hand', weight: 3 + (6 - this.tactic(p.side, 'ball_risk')) * 0.35 },
        { value: 'carry', weight: 1.5 + this.tactic(p.side, 'running_movement_emphasis') * 0.65 +
          (this.tactic(p.side, 'physicality') - 3) * 0.12 * (p.ratings.strength - p.ratings.evasion) }
      ]);
      if (choice === 'carry') this.carry(p); else this.pass(p, choice === 'kick');
    }
    this.emit('match_end', { side: this.score.winner, data: { scores: [...this.score.scores],
      pendingBonuses: this.score.bonuses.map(b => b.length),
      finalCondition: this.players.map(p => ({ playerId: p.id, energy: p.energy, available: p.available })) } });
    const stats = projectStatistics(this.input, this.events);
    return { engineVersion: MATCH_ENGINE_VERSION, status: 'complete', id: this.input.id, seed: this.input.seed,
      input: JSON.parse(JSON.stringify(this.input)) as MatchInput, config: this.config,
      winner: this.score.winner, scores: [...this.score.scores], playingSeconds: this.playing,
      elapsedSeconds: this.elapsed, quarters: this.quarters, events: this.events, ...stats };
  }
}
