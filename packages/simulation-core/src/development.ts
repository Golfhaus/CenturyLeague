import { clamp, createRandom } from './random.js';
import { calculateRoleRatings } from './roleRatings.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type Ratings } from './types.js';

export interface DevelopmentProfile {
  developmentPotential: number;
  developmentSpeed: number;
  physicalPeakOffset: number;
  technicalPeakOffset: number;
  mentalPeakOffset: number;
  declineRate: number;
  longevity: number;
  retirementTendency: number;
}

export interface DevelopmentResult {
  ratings: Ratings;
  deltas: Record<AttributeKey, number>;
  breakoutAttributes: AttributeKey[];
  defensiveRating: number;
  centralRating: number;
  attackingRating: number;
  overallRating: number;
  bestRole: 'defensive' | 'central' | 'attacking';
}

type PeakFamily = 'early_physical' | 'mid' | 'technical' | 'mental' | 'durability' | 'recovery';

const PEAK_BASE: Record<PeakFamily, number> = {
  early_physical: 25,
  mid: 28,
  technical: 30,
  mental: 32,
  durability: 29,
  recovery: 27
};

const FAMILY: Record<AttributeKey, PeakFamily> = {
  speed: 'early_physical', acceleration: 'early_physical', agility: 'early_physical', verticalLeap: 'early_physical', evasion: 'early_physical',
  strength: 'mid', stamina: 'mid', kickingPower: 'mid', ballCarrying: 'mid', contestedPossession: 'mid', groundBallSkill: 'mid', tackling: 'mid',
  kickingAccuracy: 'technical', kickingOnRun: 'technical', oppositeSideSkill: 'technical', handPassing: 'technical', aerialMarking: 'technical', defensiveSpoiling: 'technical',
  awareness: 'mental', decisionMaking: 'mental', anticipation: 'mental', composure: 'mental', discipline: 'mental',
  durability: 'durability', recovery: 'recovery'
};

function expectedAnnualChange(distanceFromPeak: number): number {
  if (distanceFromPeak <= -6) return 0.50;
  if (distanceFromPeak <= -3) return 0.36;
  if (distanceFromPeak <= -1) return 0.18;
  if (distanceFromPeak <= 1) return 0.03;
  if (distanceFromPeak <= 4) return -0.18;
  if (distanceFromPeak <= 7) return -0.36;
  return -0.58;
}

function personalPeak(attribute: AttributeKey, profile: DevelopmentProfile): number {
  const family = FAMILY[attribute];
  const offset = family === 'mental'
    ? profile.mentalPeakOffset
    : family === 'technical'
      ? profile.technicalPeakOffset
      : profile.physicalPeakOffset;
  return PEAK_BASE[family] + offset;
}

export function advanceRatingsOneSeason(
  current: Ratings,
  currentAge: number,
  profile: DevelopmentProfile,
  seed: string
): DevelopmentResult {
  const rng = createRandom(seed);
  const potentialFactor = 0.65 + ((profile.developmentPotential - 1) / 19) * 0.70;
  const speedFactor = 0.75 + ((profile.developmentSpeed - 1) / 19) * 0.50;
  const declineFactor = 0.70 + ((profile.declineRate - 1) / 19) * 0.60;
  const longevityProtection = 1.25 - ((profile.longevity - 1) / 19) * 0.50;

  const breakoutEligible = ATTRIBUTE_KEYS.filter((attribute) => currentAge < personalPeak(attribute, profile));
  const breakoutAttributes: AttributeKey[] = [];
  if (breakoutEligible.length > 0 && rng.next() < 0.03) {
    const pool = [...breakoutEligible];
    const count = 1 + Math.floor(rng.next() * Math.min(3, pool.length));
    while (breakoutAttributes.length < count && pool.length) {
      breakoutAttributes.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
    }
  }

  const deltas = {} as Record<AttributeKey, number>;
  const ratings = {} as Ratings;

  for (const attribute of ATTRIBUTE_KEYS) {
    const peak = personalPeak(attribute, profile);
    const base = expectedAnnualChange(currentAge - peak);
    const scaled = base >= 0
      ? base * potentialFactor * speedFactor
      : base * declineFactor * longevityProtection;
    const breakout = breakoutAttributes.includes(attribute) ? 0.50 + rng.next() * 0.50 : 0;
    const delta = scaled + rng.normal(0, 0.22) + breakout;
    deltas[attribute] = delta;
    ratings[attribute] = clamp(current[attribute] + delta, 1, 20);
  }

  return { ratings, deltas, breakoutAttributes, ...calculateRoleRatings(ratings) };
}

export function retirementProbability(args: {
  age: number;
  peakOverall: number;
  currentOverall: number;
  longevity: number;
  recovery: number;
  retirementTendency: number;
}): number {
  const x = -5.2
    + 0.55 * (args.age - 32)
    + 0.35 * (args.peakOverall - args.currentOverall)
    + 0.25 * (10.5 - args.longevity)
    + 0.18 * (10.5 - args.recovery)
    + 0.08 * (args.retirementTendency - 10.5);
  return 1 / (1 + Math.exp(-x));
}

export function shouldRetire(probability: number, seed: string): boolean {
  return createRandom(seed).next() < probability;
}
