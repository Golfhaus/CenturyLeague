import assert from 'node:assert/strict';
import {
  generatePlayerBatch,
  integerAgeOnDate,
  INAUGURAL_SEASON_START
} from '../packages/simulation-core/dist/index.js';

const batch = generatePlayerBatch({
  seed:'founding-pool-calibration-v1',
  menCount:450,
  womenCount:450,
  seasonStart:INAUGURAL_SEASON_START,
  entryType:'founding_pool',
  entryClassLabel:'Founding Player Pool'
});

assert.equal(batch.players.length, 900);
assert.equal(batch.summary.menCount, 450);
assert.equal(batch.summary.womenCount, 450);

for (const player of batch.players) {
  assert.equal(
    integerAgeOnDate(player.dateOfBirth, INAUGURAL_SEASON_START),
    player.metadata.entryAge
  );
  assert.ok(player.heightCm > 140 && player.heightCm < 220);
  assert.ok(player.weightKg > 40 && player.weightKg < 150);
  assert.ok(player.metadata.careerPersistence >= 1 && player.metadata.careerPersistence <= 20);
  assert.equal(player.entryType, 'founding_pool');
  assert.equal(player.entryClassLabel, 'Founding Player Pool');
}

const internationalPct = batch.summary.internationalCount / batch.players.length;
assert.ok(internationalPct >= 0.003 && internationalPct <= 0.025);

const ageCounts = batch.summary.entryAges;
const ages20to24 = [20,21,22,23,24].reduce((sum, age) => sum + (ageCounts[String(age)] ?? 0), 0);
assert.ok(ages20to24 / 900 >= 0.90);

const men = batch.players.filter((p) => p.competitionCategory === 'men');
const women = batch.players.filter((p) => p.competitionCategory === 'women');
const avg = (items, key) => items.reduce((sum, item) => sum + item[key], 0) / items.length;

const summary = {
  ...batch.summary,
  internationalPct,
  ages20to24Pct: ages20to24 / 900,
  menAverageHeightCm: avg(men, 'heightCm'),
  womenAverageHeightCm: avg(women, 'heightCm'),
  menAverageWeightKg: avg(men, 'weightKg'),
  womenAverageWeightKg: avg(women, 'weightKg'),
  samplePlayers: batch.players.slice(0, 5).map((p) => ({
    name:`${p.firstName} ${p.lastName}`,
    category:p.competitionCategory,
    age:p.metadata.entryAge,
    birthplace:`${p.birthplaceCity}, ${p.birthplaceRegionCode ?? p.birthplaceCountryCode}`,
    archetype:p.primaryArchetype,
    overall:Math.round(p.roleRatings.overall * 100) / 100
  }))
};

console.log(JSON.stringify(summary, null, 2));
console.log('\nPermanent player factory validation passed.');
