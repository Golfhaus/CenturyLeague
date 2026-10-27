import { ARCHETYPE_FREQUENCY, TALENT_CLASSES } from './config.js';
import { generateRatingsProfile } from './generator.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type ArchetypeName, type TalentClass } from './types.js';

export interface PopulationValidationSummary {
  count: number;
  overallMean: number;
  overallMin: number;
  overallMax: number;
  talentClassPercent: Record<TalentClass, number>;
  archetypePercent: Record<ArchetypeName, number>;
  secondaryArchetypePercent: number;
  offProfileGiftPercent: number;
  extremeOutlierPercent: number;
  attributeMeans: Record<AttributeKey, number>;
}

export function validateGeneratedPopulation(count = 10_000, seedPrefix = 'validation'): PopulationValidationSummary {
  const talentCounts = Object.fromEntries(Object.keys(TALENT_CLASSES).map((key) => [key, 0])) as Record<TalentClass, number>;
  const archetypeCounts = Object.fromEntries(Object.keys(ARCHETYPE_FREQUENCY).map((key) => [key, 0])) as Record<ArchetypeName, number>;
  const sums = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 0])) as Record<AttributeKey, number>;
  let overallSum = 0;
  let overallMin = Number.POSITIVE_INFINITY;
  let overallMax = Number.NEGATIVE_INFINITY;
  let secondary = 0;
  let gifts = 0;
  let outliers = 0;

  for (let i = 0; i < count; i += 1) {
    const p = generateRatingsProfile({
      seed: seedPrefix + '-' + i,
      competitionCategory: i % 2 ? 'women' : 'men',
      entryAge: 22
    });
    talentCounts[p.talentClass] += 1;
    archetypeCounts[p.primaryArchetype] += 1;
    if (p.secondaryArchetype) secondary += 1;
    if (p.offProfileGift) gifts += 1;
    if (p.extremeOutlier) outliers += 1;
    overallSum += p.overallRating;
    overallMin = Math.min(overallMin, p.overallRating);
    overallMax = Math.max(overallMax, p.overallRating);
    for (const key of ATTRIBUTE_KEYS) sums[key] += p.ratings[key];
  }

  const pct = (value: number) => (value / count) * 100;
  return {
    count,
    overallMean: overallSum / count,
    overallMin,
    overallMax,
    talentClassPercent: Object.fromEntries(Object.entries(talentCounts).map(([k, v]) => [k, pct(v)])) as Record<TalentClass, number>,
    archetypePercent: Object.fromEntries(Object.entries(archetypeCounts).map(([k, v]) => [k, pct(v)])) as Record<ArchetypeName, number>,
    secondaryArchetypePercent: pct(secondary),
    offProfileGiftPercent: pct(gifts),
    extremeOutlierPercent: pct(outliers),
    attributeMeans: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, sums[key] / count])) as Record<AttributeKey, number>
  };
}
