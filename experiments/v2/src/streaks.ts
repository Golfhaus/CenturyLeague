/** Experimental, pre-match-only effects. No history writes or player-rating edits. */
export type StreakFeature = 'confidence' | 'frustration';
export interface StreakSettings {
  enabled: StreakFeature[];
  /** Positive = consecutive official wins; negative = consecutive official losses. */
  streaks: [number, number];
  confidenceScale?: number;
  frustrationScale?: number;
}
export interface ResolvedStreakSettings {
  enabled: StreakFeature[]; streaks: [number, number]; confidenceScale: number; frustrationScale: number;
}
export interface ProbabilityCounter {
  opportunities: number; successes: number; baselineProbabilitySum: number; adjustedProbabilitySum: number;
  immediateOutcomesChanged: number;
}
export interface StreakTelemetry {
  settings: ResolvedStreakSettings;
  confidence: Record<string, [ProbabilityCounter, ProbabilityCounter]>;
  contacts: [number, number];
  severity: [ProbabilityCounter, ProbabilityCounter];
}
const FEATURES = ['confidence', 'frustration'];
export function resolveStreakSettings(value?: StreakSettings): ResolvedStreakSettings {
  if (value === undefined) return { enabled: [], streaks: [0, 0], confidenceScale: 1, frustrationScale: 1 };
  if (!value || typeof value !== 'object' || Object.keys(value).some(key =>
      !['enabled', 'streaks', 'confidenceScale', 'frustrationScale'].includes(key)) ||
      !Array.isArray(value.enabled) || new Set(value.enabled).size !== value.enabled.length ||
      value.enabled.some(feature => !FEATURES.includes(feature)) || !Array.isArray(value.streaks) || value.streaks.length !== 2 ||
      value.streaks.some(streak => !Number.isSafeInteger(streak) || Math.abs(streak) > 1000)) {
    throw new Error('Invalid pinned lab streak settings');
  }
  const confidenceScale = value.confidenceScale ?? 1, frustrationScale = value.frustrationScale ?? 1;
  if (![confidenceScale, frustrationScale].every(scale => Number.isFinite(scale) && scale >= 0 && scale <= 4))
    throw new Error('Lab scales must be finite and between 0 and 4');
  return { enabled: [...value.enabled].sort(), streaks: [...value.streaks], confidenceScale, frustrationScale };
}
export function confidenceOddsBonus(streak: number, scale = 1): number {
  return Math.min(0.02, Math.max(0, streak - 1) * 0.005) * scale;
}
export function frustrationRelativeBonus(streak: number, discipline: number, scale = 1): number {
  const streakEffect = Math.min(0.08, Math.max(0, -streak - 1) * 0.02);
  return streakEffect * ((21 - discipline) / 20) * scale;
}
/** Multiplier applies to ODDS, not percentage points; two equally confident sides cancel. */
export function confidenceProbability(probability: number, ownStreak: number, opposingStreak = 0, scale = 1): number {
  const multiplier = (1 + confidenceOddsBonus(ownStreak, scale)) / (1 + confidenceOddsBonus(opposingStreak, scale));
  if (multiplier === 1 || probability === 0 || probability === 1) return probability;
  return probability * multiplier / (1 - probability + probability * multiplier);
}
export function seriousFoulProbability(probability: number, streak: number, discipline: number, scale = 1): number {
  return Math.min(1, probability * (1 + frustrationRelativeBonus(streak, discipline, scale)));
}
export function counter(): ProbabilityCounter {
  return { opportunities: 0, successes: 0, baselineProbabilitySum: 0, adjustedProbabilitySum: 0, immediateOutcomesChanged: 0 };
}
export function recordProbability(target: ProbabilityCounter, baseline: number, adjusted: number, roll: number): void {
  target.opportunities++; target.successes += Number(roll < adjusted);
  target.baselineProbabilitySum += baseline; target.adjustedProbabilitySum += adjusted;
  target.immediateOutcomesChanged += Number((roll < baseline) !== (roll < adjusted));
}
export function telemetry(settings: ResolvedStreakSettings): StreakTelemetry {
  return { settings, confidence: {}, contacts: [0, 0], severity: [counter(), counter()] };
}
