import {
  ARCHETYPE_FREQUENCY,
  ARCHETYPE_MODIFIERS,
  EXTREME_OUTLIER_CHANCE,
  OFF_PROFILE_GIFT_CHANCE,
  SECONDARY_ARCHETYPE_CHANCE,
  SECONDARY_ARCHETYPE_STRENGTH,
  TALENT_CLASSES
} from './config.js';
import { clamp, createRandom, truncatedNormal, weightedChoice } from './random.js';
import { calculateRoleRatings } from './roleRatings.js';
import { ATTRIBUTE_KEYS, type ArchetypeName, type AttributeKey, type Foundations, type GeneratedRatingsProfile, type GenerationInput, type Ratings, type TalentClass } from './types.js';

const FOUNDATION_LOADINGS: Record<AttributeKey, Partial<Record<keyof Foundations, number>>> = {
  speed: { athleticism: 0.90 },
  acceleration: { athleticism: 0.95 },
  agility: { athleticism: 0.70, coordination: 0.25 },
  strength: { power: 0.90 },
  verticalLeap: { athleticism: 0.55, power: 0.30 },
  stamina: { endurance: 0.90 },
  durability: { power: 0.20, endurance: 0.20 },
  recovery: { endurance: 0.38 },
  kickingPower: { power: 0.50, coordination: 0.25 },
  kickingAccuracy: { coordination: 0.85 },
  kickingOnRun: { coordination: 0.65, athleticism: 0.20 },
  oppositeSideSkill: { coordination: 0.70 },
  handPassing: { coordination: 0.85 },
  ballCarrying: { coordination: 0.55, athleticism: 0.30 },
  evasion: { athleticism: 0.55, coordination: 0.30 },
  aerialMarking: { coordination: 0.45, athleticism: 0.25, power: 0.15 },
  contestedPossession: { power: 0.45, coordination: 0.25 },
  groundBallSkill: { coordination: 0.70, athleticism: 0.15 },
  tackling: { power: 0.45, athleticism: 0.20, coordination: 0.15 },
  defensiveSpoiling: { athleticism: 0.25, power: 0.25, coordination: 0.25 },
  awareness: { gameSense: 0.90 },
  decisionMaking: { gameSense: 0.80, coordination: 0.10 },
  anticipation: { gameSense: 0.90 },
  composure: { gameSense: 0.40 },
  discipline: { gameSense: 0.30 }
};

const BODY_LOADINGS: Partial<Record<AttributeKey, { height?: number; mass?: number }>> = {
  aerialMarking: { height: 0.70 },
  defensiveSpoiling: { height: 0.60 },
  strength: { height: 0.10, mass: 0.65 },
  contestedPossession: { mass: 0.50 },
  tackling: { mass: 0.35 },
  agility: { height: -0.15, mass: -0.20 },
  acceleration: { height: -0.10, mass: -0.15 },
  stamina: { mass: -0.15 }
};

const CLUSTER_MEMBERSHIP: Partial<Record<AttributeKey, string>> = {
  speed: 'pace', acceleration: 'pace', agility: 'pace', evasion: 'pace',
  kickingPower: 'kicking', kickingAccuracy: 'kicking', kickingOnRun: 'kicking', oppositeSideSkill: 'kicking',
  handPassing: 'handling', ballCarrying: 'handling', groundBallSkill: 'handling',
  aerialMarking: 'aerial', verticalLeap: 'aerial', defensiveSpoiling: 'aerial',
  strength: 'contest', contestedPossession: 'contest', tackling: 'contest',
  awareness: 'mental', anticipation: 'mental', decisionMaking: 'mental', composure: 'mental'
};

function drawTalentClass(rng: ReturnType<typeof createRandom>, age: number): TalentClass {
  const ageBoost = age <= 17 ? 1.9 : age === 18 ? 1.45 : age === 19 ? 1.15 : age >= 25 ? 1.15 : 1;
  const entries = Object.entries(TALENT_CLASSES).map(([value, config], index) => ({
    value: value as TalentClass,
    weight: config.weight * (index >= 2 ? ageBoost : 1)
  }));
  return weightedChoice(rng, entries);
}

function drawFoundations(rng: ReturnType<typeof createRandom>, talent: number): Foundations {
  const correlated = 0.30 * talent;
  const residualScale = Math.sqrt(1 - 0.30 ** 2);
  const draw = () => correlated + residualScale * rng.normal();
  return { athleticism: draw(), power: draw(), coordination: draw(), endurance: draw(), gameSense: draw() };
}

function foundationScore(attribute: AttributeKey, foundations: Foundations): number {
  const loadings = FOUNDATION_LOADINGS[attribute];
  return Object.entries(loadings).reduce((sum, [key, weight]) => sum + foundations[key as keyof Foundations] * (weight ?? 0), 0);
}

function archetypeVector(primary: ArchetypeName, secondary: ArchetypeName | null, specialization: number): Record<AttributeKey, number> {
  const factor = 0.80 + 0.05 * (specialization - 10.5);
  return Object.fromEntries(ATTRIBUTE_KEYS.map((attribute) => {
    const primaryValue = ARCHETYPE_MODIFIERS[primary][attribute] ?? 0;
    const secondaryValue = secondary ? (ARCHETYPE_MODIFIERS[secondary][attribute] ?? 0) * SECONDARY_ARCHETYPE_STRENGTH : 0;
    return [attribute, (primaryValue + secondaryValue) * factor];
  })) as Record<AttributeKey, number>;
}

function signatureAdjustments(rng: ReturnType<typeof createRandom>, specialization: number, primary: ArchetypeName) {
  const result = Object.fromEntries(ATTRIBUTE_KEYS.map((a) => [a, 0])) as Record<AttributeKey, number>;
  const high = specialization >= 15;
  const low = specialization <= 6;
  const strengths = low ? (rng.next() < 0.5 ? 0 : 1) : high ? 2 + (rng.next() < 0.5 ? 1 : 0) : 1 + (rng.next() < 0.45 ? 1 : 0);
  const weaknesses = low ? (rng.next() < 0.5 ? 0 : 1) : high ? 2 + Math.floor(rng.next() * 3) : 1 + (rng.next() < 0.45 ? 1 : 0);
  const preferredStrengths = ATTRIBUTE_KEYS.filter((a) => (ARCHETYPE_MODIFIERS[primary][a] ?? 0) > 0);
  const preferredWeaknesses = ATTRIBUTE_KEYS.filter((a) => (ARCHETYPE_MODIFIERS[primary][a] ?? 0) < 0);
  const chooseUnique = (pool: readonly AttributeKey[], count: number) => {
    const copy = [...pool];
    const selected: AttributeKey[] = [];
    while (copy.length && selected.length < count) selected.push(copy.splice(Math.floor(rng.next() * copy.length), 1)[0]);
    return selected;
  };
  chooseUnique(preferredStrengths.length ? preferredStrengths : ATTRIBUTE_KEYS, strengths).forEach((a) => { result[a] += rng.next() < 0.12 ? 3 : rng.next() < 0.55 ? 2 : 1; });
  chooseUnique(preferredWeaknesses.length ? preferredWeaknesses : ATTRIBUTE_KEYS, weaknesses).forEach((a) => { result[a] -= rng.next() < 0.10 ? 3 : rng.next() < 0.55 ? 2 : 1; });
  return result;
}

export function generateRatingsProfile(input: GenerationInput): GeneratedRatingsProfile {
  const rng = createRandom(input.seed);
  const talentClass = drawTalentClass(rng, input.entryAge);
  const talentConfig = TALENT_CLASSES[talentClass];
  const talentLatent = clamp(rng.normal(talentConfig.mean, talentConfig.sd), -2.0, 3.5);
  const foundations = drawFoundations(rng, talentLatent);
  const specialization = truncatedNormal(rng, 11.5, 4.0, 1, 20);
  const archetypeEntries = Object.entries(ARCHETYPE_FREQUENCY).map(([value, weight]) => ({ value: value as ArchetypeName, weight }));
  const primaryArchetype = weightedChoice(rng, archetypeEntries);
  const secondaryArchetype = rng.next() < SECONDARY_ARCHETYPE_CHANCE
    ? weightedChoice(rng, archetypeEntries.filter((entry) => entry.value !== primaryArchetype))
    : null;
  const archetypes = archetypeVector(primaryArchetype, secondaryArchetype, specialization);
  const signatures = signatureAdjustments(rng, specialization, primaryArchetype);
  const offProfileGift = rng.next() < OFF_PROFILE_GIFT_CHANCE;
  const extremeOutlier = rng.next() < EXTREME_OUTLIER_CHANCE;
  if (offProfileGift) {
    const neutral = ATTRIBUTE_KEYS.filter((a) => (ARCHETYPE_MODIFIERS[primaryArchetype][a] ?? 0) <= 0);
    const target = neutral[Math.floor(rng.next() * neutral.length)] ?? ATTRIBUTE_KEYS[Math.floor(rng.next() * ATTRIBUTE_KEYS.length)];
    signatures[target] += 2 + (rng.next() < 0.25 ? 1 : 0);
  }

  const clusters: Record<string, number> = {
    pace: rng.normal(), kicking: rng.normal(), handling: rng.normal(), aerial: rng.normal(), contest: rng.normal(), mental: rng.normal()
  };
  const heightZ = input.heightZ ?? rng.normal();
  const massZ = input.weightForHeightZ ?? rng.normal();

  const ratings = Object.fromEntries(ATTRIBUTE_KEYS.map((attribute) => {
    const body = BODY_LOADINGS[attribute];
    const bodyScore = (body?.height ?? 0) * heightZ + (body?.mass ?? 0) * massZ;
    const clusterName = CLUSTER_MEMBERSHIP[attribute];
    const correlated = clusterName ? clusters[clusterName] : 0;
    const individualNoiseScale = primaryArchetype === 'balanced_all_rounder' ? 0.60 : extremeOutlier ? 1.45 : 1;
    const z = 0.50 * talentLatent
      + 0.45 * foundationScore(attribute, foundations)
      + 0.28 * archetypes[attribute]
      + 0.12 * bodyScore
      + 0.18 * correlated
      + 0.26 * rng.normal() * individualNoiseScale;
    const rating = clamp(10.5 + 2.35 * z + signatures[attribute], 1, 20);
    return [attribute, rating];
  })) as Ratings;

  const roles = calculateRoleRatings(ratings);
  return {
    ratings,
    displayedRatings: Object.fromEntries(ATTRIBUTE_KEYS.map((a) => [a, Math.round(ratings[a])])) as Record<AttributeKey, number>,
    ...roles,
    talentClass,
    talentLatent,
    foundations,
    specialization,
    primaryArchetype,
    secondaryArchetype,
    offProfileGift,
    extremeOutlier
  };
}
