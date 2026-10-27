import { clamp, createRandom, truncatedNormal } from './random.ts';
import type { DevelopmentProfile } from './development.ts';

export const POOL_EXIT_MODEL_VERSION = '1.0.0';
export const DEFAULT_TARGET_ACTIVE_POPULATION = 900;
export const DEFAULT_TARGET_FREE_AGENT_POPULATION = 270;

export interface UnsignedPoolExitInputs {
  ageYears: number;
  unsignedMonths: number;
  marketPercentile: number;
  twelveMonthOverallTrend: number;
  previouslyRostered: boolean;
  monthsSinceRelease: number | null;
  careerPersistence: number;
  freeAgentCount: number;
  targetFreeAgentCount?: number;
}

export interface PoolExitComponents {
  intercept: number;
  agePressure: number;
  unsignedTimePressure: number;
  marketPressure: number;
  trendPressure: number;
  priorRosterAdjustment: number;
  releaseGraceAdjustment: number;
  persistenceAdjustment: number;
}

export interface UnsignedPoolExitEvaluation {
  baseProbability: number;
  poolPressureMultiplier: number;
  exitProbability: number;
  randomRoll: number;
  exited: boolean;
  components: PoolExitComponents;
}

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

export function poolPressureMultiplier(
  freeAgentCount: number,
  targetFreeAgentCount = DEFAULT_TARGET_FREE_AGENT_POPULATION
): number {
  if (targetFreeAgentCount <= 0) {
    throw new Error('targetFreeAgentCount must be greater than zero.');
  }
  const ratio = Math.max(0, freeAgentCount) / targetFreeAgentCount;
  return clamp(1 + 0.50 * (ratio - 1), 0.85, 1.20);
}

export function calculateUnsignedPoolExitProbability(
  input: UnsignedPoolExitInputs
): Omit<UnsignedPoolExitEvaluation, 'randomRoll' | 'exited'> {
  const marketPercentile = clamp(input.marketPercentile, 0, 1);
  const careerPersistence = clamp(input.careerPersistence, 1, 20);
  const unsignedMonths = Math.max(0, input.unsignedMonths);

  const components: PoolExitComponents = {
    intercept: -3.80,
    agePressure:
      0.16 * Math.max(0, input.ageYears - 22)
      + 0.16 * Math.max(0, input.ageYears - 28)
      + 0.15 * Math.max(0, input.ageYears - 32),
    unsignedTimePressure:
      0.035 * Math.max(0, unsignedMonths - 6)
      + 0.025 * Math.max(0, unsignedMonths - 18)
      + 0.020 * Math.max(0, unsignedMonths - 36),
    marketPressure: (0.50 - marketPercentile) * 2.40,
    trendPressure: -0.35 * input.twelveMonthOverallTrend,
    priorRosterAdjustment: input.previouslyRostered ? -0.75 : 0,
    releaseGraceAdjustment:
      input.previouslyRostered && input.monthsSinceRelease !== null
        ? input.monthsSinceRelease <= 6
          ? -1.20
          : input.monthsSinceRelease <= 12
            ? -0.50
            : 0
        : 0,
    persistenceAdjustment: (10.5 - careerPersistence) * 0.12
  };

  const logitScore = Object.values(components).reduce((sum, value) => sum + value, 0);
  const baseProbability = logistic(logitScore);
  const pressure = poolPressureMultiplier(
    input.freeAgentCount,
    input.targetFreeAgentCount ?? DEFAULT_TARGET_FREE_AGENT_POPULATION
  );

  return {
    baseProbability,
    poolPressureMultiplier: pressure,
    exitProbability: clamp(baseProbability * pressure, 0, 0.98),
    components
  };
}

export function evaluateUnsignedPoolExit(
  input: UnsignedPoolExitInputs,
  seed: string
): UnsignedPoolExitEvaluation {
  const probability = calculateUnsignedPoolExitProbability(input);
  const randomRoll = createRandom(seed).next();
  return {
    ...probability,
    randomRoll,
    exited: randomRoll < probability.exitProbability
  };
}

export interface MarketCandidate {
  id: string;
  overallRating: number;
}

export function marketPercentiles(
  candidates: readonly MarketCandidate[]
): Map<string, number> {
  const result = new Map<string, number>();
  if (candidates.length === 0) return result;
  if (candidates.length === 1) {
    result.set(candidates[0].id, 0.5);
    return result;
  }

  const scores = candidates.map((candidate) => candidate.overallRating);
  for (const candidate of candidates) {
    let lower = 0;
    let equal = 0;
    for (const score of scores) {
      if (score < candidate.overallRating) lower += 1;
      else if (score === candidate.overallRating) equal += 1;
    }
    result.set(candidate.id, (lower + equal * 0.5) / candidates.length);
  }
  return result;
}

export function generateDevelopmentProfile(seed: string): DevelopmentProfile {
  const rng = createRandom(seed);
  return {
    developmentPotential: truncatedNormal(rng, 10.5, 4.0, 1, 20),
    developmentSpeed: truncatedNormal(rng, 10.5, 3.5, 1, 20),
    physicalPeakOffset: truncatedNormal(rng, 0, 1.25, -3, 3),
    technicalPeakOffset: truncatedNormal(rng, 0, 1.25, -3, 3),
    mentalPeakOffset: truncatedNormal(rng, 0, 1.25, -3, 3),
    declineRate: truncatedNormal(rng, 10.5, 3.5, 1, 20),
    longevity: truncatedNormal(rng, 10.5, 4.0, 1, 20),
    retirementTendency: truncatedNormal(rng, 10.5, 4.0, 1, 20),
    careerPersistence: truncatedNormal(rng, 10.5, 4.0, 1, 20)
  };
}
