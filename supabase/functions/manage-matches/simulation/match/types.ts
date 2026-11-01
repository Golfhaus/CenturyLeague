import type { Ratings } from '../types.ts';

export type Side = 0 | 1;
export interface MatchPlayer { id: string; name: string; ratings: Ratings }
export const TACTIC_KEYS = ['tempo', 'physicality', 'defensive_posture', 'pressure',
  'transition_emphasis', 'width', 'aerial_emphasis', 'ball_risk',
  'running_movement_emphasis', 'defensive_aggression'] as const;
export type Tactics = Record<typeof TACTIC_KEYS[number], number>;
export interface MatchTeam {
  id: string; name: string; coach: { name: string; tactics: Tactics }; players: MatchPlayer[];
}
export interface MatchConfig {
  fieldLength: number; fieldWidth: number; onField: number; minimumPlayers: number;
  standardPenaltySeconds: number; seriousPenaltySeconds: number;
  intervalSeconds: [number, number, number];
  maxEvents: number; maxPlayingSeconds: number;
  fatiguePerSecond: number; benchRecoveryPerSecond: number;
  injuryChancePerContest: number; substitutionReviewSeconds: number;
}
export interface MatchInput {
  id: string; seed: string; teams: [MatchTeam, MatchTeam]; config?: Partial<MatchConfig>;
  provenance?: Record<string, string>;
}
export type ScoringKind = 'central_air' | 'central_bounce' | 'outer_air' | 'outer_deflection' | 'bonus';
export interface HeldBonus { playerId: string; eventId: number }
export interface ScoreState { scores: [number, number]; bonuses: [HeldBonus[], HeldBonus[]]; winner: Side | null }
export interface ScoreCredit { playerId: string; points: number; source: 'kick' | 'bonus' }
export interface ScoreResolution {
  kind: ScoringKind; nominalPoints: number; awardedPoints: number; credits: ScoreCredit[];
  bonusesConverted: number; bonusesLost: number; pointsCapped: number;
  winning: boolean; state: ScoreState;
}
export interface StatCredit { playerId: string; stat: string; amount?: number }
export interface MatchEvent {
  id: number; type: string; quarter: number; playingSeconds: number; elapsedSeconds: number;
  side?: Side; playerId?: string; otherPlayerId?: string;
  x?: number; y?: number; credits?: StatCredit[]; data?: Record<string, unknown>;
}
export interface QuarterResult {
  quarter: number; cumulative: [number, number]; points: [number, number];
  playingSeconds: number; elapsedSeconds: number;
}
export interface PlayerStats {
  id: string; name: string; side: Side; secondsPlayed: number; stats: Record<string, number>;
}
export interface MatchResult {
  engineVersion: string; status: 'complete'; id: string; seed: string;
  input: MatchInput; config: MatchConfig; winner: Side; scores: [number, number];
  playingSeconds: number; elapsedSeconds: number; quarters: QuarterResult[];
  events: MatchEvent[]; players: PlayerStats[]; teamStats: [Record<string, number>, Record<string, number>];
}
