/** Experimental, pre-match-only effects. No history writes or player-rating edits. */
export type StreakFeature = 'confidence' | 'frustration' | 'home-support';
export interface SharedPsychology {
  version: 'shared-psych-v1'; homeSide: 0 | 1 | null; homeOddsBonus: number; maximumOddsBonus: number;
}
export interface StreakSettings {
  enabled: StreakFeature[];
  /** Positive = consecutive official wins; negative = consecutive official losses. */
  streaks: [number, number];
  confidenceScale?: number;
  frustrationScale?: number;
  psychology?: SharedPsychology;
}
export interface ResolvedStreakSettings {
  enabled: StreakFeature[]; streaks: [number, number]; confidenceScale: number; frustrationScale: number; psychology?: SharedPsychology;
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
  psychology?: { contributions: [PsychologyContribution, PsychologyContribution] };
}
const FEATURES = ['confidence', 'frustration', 'home-support'];
export function resolveStreakSettings(value?: StreakSettings): ResolvedStreakSettings {
  if (value === undefined) return { enabled: [], streaks: [0, 0], confidenceScale: 1, frustrationScale: 1 };
  if (!value || typeof value !== 'object' || Object.keys(value).some(key =>
      !['enabled', 'streaks', 'confidenceScale', 'frustrationScale', 'psychology'].includes(key)) ||
      !Array.isArray(value.enabled) || new Set(value.enabled).size !== value.enabled.length ||
      value.enabled.some(feature => !FEATURES.includes(feature)) || !Array.isArray(value.streaks) || value.streaks.length !== 2 ||
      value.streaks.some(streak => !Number.isSafeInteger(streak) || Math.abs(streak) > 1000)) {
    throw new Error('Invalid pinned lab streak settings');
  }
  const confidenceScale = value.confidenceScale ?? 1, frustrationScale = value.frustrationScale ?? 1;
  if (![confidenceScale, frustrationScale].every(scale => Number.isFinite(scale) && scale >= 0 && scale <= 4))
    throw new Error('Lab scales must be finite and between 0 and 4');
  const psych = value.psychology;
  if (psych !== undefined && (!psych || typeof psych !== 'object' || psych.version !== 'shared-psych-v1' ||
      Object.keys(psych).some(key => !['version','homeSide','homeOddsBonus','maximumOddsBonus'].includes(key)) ||
      ![null,0,1].includes(psych.homeSide) ||
      ![psych.homeOddsBonus,psych.maximumOddsBonus].every(x => Number.isFinite(x) && x >= 0 && x <= 0.02)))
    throw new Error('Invalid pinned shared psychological policy');
  if (value.enabled.includes('home-support') && !psych) throw new Error('Home support requires a pinned shared psychological policy and venue');
  return { enabled: [...value.enabled].sort(), streaks: [...value.streaks], confidenceScale, frustrationScale,
    ...(psych ? { psychology: { ...psych } } : {}) }; 
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
export interface PsychologyContribution {
  confidenceOddsBonus: number; homeOddsBonus: number; crowdEnthusiasm: number;
  rawOddsBonus: number; appliedOddsBonus: number; saturated: boolean;
}
export function crowdEnthusiasm(streak: number): number {
  if (streak <= -2) return Math.max(0, 1 - (-streak - 1) * 0.25);
  if (streak >= 2) return 1 + Math.min(4, streak - 1) * 0.075;
  return 1;
}
export function psychologyContribution(settings: ResolvedStreakSettings, side: 0 | 1): PsychologyContribution {
  const confidence = settings.enabled.includes('confidence') ? confidenceOddsBonus(settings.streaks[side], settings.confidenceScale) : 0;
  const crowd = settings.psychology?.homeSide === side ? crowdEnthusiasm(settings.streaks[side]) : 0;
  const home = settings.enabled.includes('home-support') ? (settings.psychology?.homeOddsBonus ?? 0) * crowd : 0;
  const raw = (1 + confidence) * (1 + home) - 1;
  // The shared ceiling is an execution-odds bound, never an imposed match winner or win-rate clamp.
  const applied = settings.psychology ? Math.min(raw, settings.psychology.maximumOddsBonus) : confidence;
  return { confidenceOddsBonus: confidence, homeOddsBonus: home, crowdEnthusiasm: crowd,
    rawOddsBonus: raw, appliedOddsBonus: applied, saturated: applied < raw - 1e-14 };
}
export function psychologicalProbability(probability: number, settings: ResolvedStreakSettings, side: 0 | 1, opposing = false): number {
  // Keep existing saved legacy inputs compatible; the new policy is explicit and versioned.
  if (!settings.psychology) return settings.enabled.includes('confidence') ? confidenceProbability(probability, settings.streaks[side],
    opposing ? settings.streaks[(1-side) as 0 | 1] : 0, settings.confidenceScale) : probability;
  const own = psychologyContribution(settings, side).appliedOddsBonus;
  const other = opposing ? psychologyContribution(settings, (1-side) as 0 | 1).appliedOddsBonus : 0;
  if (own === other || probability === 0 || probability === 1) return probability;
  const multiplier = (1+own)/(1+other);
  return probability * multiplier / (1-probability + probability * multiplier);
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
  return { settings, confidence: {}, contacts: [0, 0], severity: [counter(), counter()],
    ...(settings.psychology ? { psychology: { contributions: [psychologyContribution(settings,0), psychologyContribution(settings,1)] as [PsychologyContribution,PsychologyContribution] } } : {}) };
}
