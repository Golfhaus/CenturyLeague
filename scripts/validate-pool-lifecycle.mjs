import assert from 'node:assert/strict';
import {
  calculateUnsignedPoolExitProbability,
  entryClassLabelForTriggerSeason,
  entryWindowName,
  generateDevelopmentProfile,
  isEntryWindowTriggerMonth,
  marketPercentiles,
  poolPressureMultiplier
} from '../packages/simulation-core/dist/index.js';

for (const month of [3, 6, 9, 12]) assert.equal(isEntryWindowTriggerMonth(month), true);
for (const month of [1, 2, 4, 5, 7, 8, 10, 11]) assert.equal(isEntryWindowTriggerMonth(month), false);

assert.equal(entryWindowName(2026, 12), 'Winter 2026');
assert.equal(entryClassLabelForTriggerSeason(2026, 12), 'January 2027 Entry Class');
assert.equal(entryClassLabelForTriggerSeason(2027, 3), 'April 2027 Entry Class');

function probability(input) {
  return calculateUnsignedPoolExitProbability({
    freeAgentCount: 270,
    targetFreeAgentCount: 270,
    ...input
  }).exitProbability;
}

const youngProspect = probability({
  ageYears: 21,
  unsignedMonths: 9,
  marketPercentile: 0.65,
  twelveMonthOverallTrend: 0.3,
  previouslyRostered: false,
  monthsSinceRelease: null,
  careerPersistence: 11
});
assert.ok(youngProspect >= 0.01 && youngProspect <= 0.03);

const weak24 = probability({
  ageYears: 24,
  unsignedMonths: 18,
  marketPercentile: 0.20,
  twelveMonthOverallTrend: 0,
  previouslyRostered: false,
  monthsSinceRelease: null,
  careerPersistence: 10
});
assert.ok(weak24 >= 0.05 && weak24 <= 0.11);

const bottom27 = probability({
  ageYears: 27,
  unsignedMonths: 24,
  marketPercentile: 0.15,
  twelveMonthOverallTrend: 0,
  previouslyRostered: false,
  monthsSinceRelease: null,
  careerPersistence: 10
});
assert.ok(bottom27 >= 0.15 && bottom27 <= 0.27);

const formerGood33 = probability({
  ageYears: 33,
  unsignedMonths: 18,
  marketPercentile: 0.70,
  twelveMonthOverallTrend: -0.2,
  previouslyRostered: true,
  monthsSinceRelease: 15,
  careerPersistence: 12
});
assert.ok(formerGood33 >= 0.08 && formerGood33 <= 0.20);

const decliningFringe34 = probability({
  ageYears: 34,
  unsignedMonths: 24,
  marketPercentile: 0.10,
  twelveMonthOverallTrend: -0.6,
  previouslyRostered: true,
  monthsSinceRelease: 24,
  careerPersistence: 8
});
assert.ok(decliningFringe34 >= 0.50 && decliningFringe34 <= 0.75);

assert.equal(poolPressureMultiplier(0, 270), 0.85);
assert.equal(poolPressureMultiplier(270, 270), 1);
assert.equal(poolPressureMultiplier(500, 270), 1.20);

const percentiles = marketPercentiles([
  { id: 'low', overallRating: 8 },
  { id: 'middle-a', overallRating: 11 },
  { id: 'middle-b', overallRating: 11 },
  { id: 'high', overallRating: 15 }
]);
assert.ok((percentiles.get('low') ?? 1) < (percentiles.get('middle-a') ?? 0));
assert.equal(percentiles.get('middle-a'), percentiles.get('middle-b'));
assert.ok((percentiles.get('high') ?? 0) > (percentiles.get('middle-a') ?? 1));

for (let i = 0; i < 100; i += 1) {
  const profile = generateDevelopmentProfile('persistence-' + i);
  assert.ok(profile.careerPersistence >= 1 && profile.careerPersistence <= 20);
  assert.ok(profile.developmentPotential >= 1 && profile.developmentPotential <= 20);
  assert.ok(profile.longevity >= 1 && profile.longevity <= 20);
}

console.log(JSON.stringify({
  youngProspect,
  weak24,
  bottom27,
  formerGood33,
  decliningFringe34,
  winter2026Class: entryClassLabelForTriggerSeason(2026, 12)
}, null, 2));

console.log('\nQuarterly player-pool lifecycle validation passed.');
