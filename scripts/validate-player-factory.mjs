import assert from 'node:assert/strict';
import {
  generatePlayerBatch,
  integerAgeOnDate,
  INAUGURAL_SEASON_START,
  normalizeFullName
} from '../packages/simulation-core/dist/index.js';

const batch = generatePlayerBatch({
  seed:'founding-pool-calibration-v1',
  competitionCategory:'men',
  count:900,
  seasonStart:INAUGURAL_SEASON_START,
  entryType:'founding_pool',
  entryClassLabel:'Founding Player Pool'
});

assert.equal(batch.players.length, 900);
assert.equal(batch.summary.competitionCategory, 'men');

const fullNames = new Set();

for (const player of batch.players) {
  assert.equal(player.competitionCategory, 'men');
  assert.equal(
    integerAgeOnDate(player.dateOfBirth, INAUGURAL_SEASON_START),
    player.metadata.entryAge
  );
  assert.ok(player.heightCm > 140 && player.heightCm < 220);
  assert.ok(player.weightKg > 40 && player.weightKg < 150);
  assert.ok(player.metadata.careerPersistence >= 1 && player.metadata.careerPersistence <= 20);
  assert.equal(player.entryType, 'founding_pool');
  assert.equal(player.entryClassLabel, 'Founding Player Pool');

  const key = normalizeFullName(player.firstName, player.lastName);
  assert.equal(fullNames.has(key), false, `Duplicate active full name generated: ${player.firstName} ${player.lastName}`);
  fullNames.add(key);
}

assert.equal(fullNames.size, 900);
assert.ok(batch.summary.uniqueFirstNames >= 180);
assert.ok(batch.summary.uniqueLastNames >= 300);

const internationalPct = batch.summary.internationalCount / batch.players.length;
assert.ok(internationalPct >= 0.003 && internationalPct <= 0.025);

const ageCounts = batch.summary.entryAges;
const ages20to24 = [20,21,22,23,24].reduce((sum, age) => sum + (ageCounts[String(age)] ?? 0), 0);
assert.ok(ages20to24 / 900 >= 0.90);

const rightPct = (batch.summary.preferredSides.right ?? 0) / 900;
const leftPct = (batch.summary.preferredSides.left ?? 0) / 900;
const bothPct = (batch.summary.preferredSides.both ?? 0) / 900;
const secondaryArchetypePct = batch.players.filter((player) => Boolean(player.secondaryArchetype)).length / 900;
assert.ok(rightPct >= 0.72 && rightPct <= 0.84);
assert.ok(leftPct >= 0.12 && leftPct <= 0.24);
assert.ok(bothPct >= 0.01 && bothPct <= 0.08);
assert.ok(secondaryArchetypePct >= 0.34 && secondaryArchetypePct <= 0.46);

// Prove that collision resolution changes only identity, not the underlying player profile.
const reserved = batch.players.slice(0, 50).map((player) =>
  normalizeFullName(player.firstName, player.lastName)
);
const rerolled = generatePlayerBatch({
  seed:'founding-pool-calibration-v1',
  competitionCategory:'men',
  count:50,
  seasonStart:INAUGURAL_SEASON_START,
  entryType:'founding_pool',
  entryClassLabel:'Founding Player Pool',
  reservedFullNames:reserved
});

assert.ok(rerolled.summary.nameCollisionRerolls >= 50);

for (let i = 0; i < rerolled.players.length; i += 1) {
  const original = batch.players[i];
  const replacement = rerolled.players[i];
  assert.notEqual(
    normalizeFullName(original.firstName, original.lastName),
    normalizeFullName(replacement.firstName, replacement.lastName)
  );
  assert.deepEqual(replacement.ratings, original.ratings);
  assert.deepEqual(replacement.roleRatings, original.roleRatings);
  assert.equal(replacement.dateOfBirth, original.dateOfBirth);
  assert.equal(replacement.heightCm, original.heightCm);
  assert.equal(replacement.weightKg, original.weightKg);
  assert.equal(replacement.primaryArchetype, original.primaryArchetype);
  assert.equal(replacement.secondaryArchetype, original.secondaryArchetype);
}

const avg = (items, key) => items.reduce((sum, item) => sum + item[key], 0) / items.length;

const summary = {
  ...batch.summary,
  internationalPct,
  ages20to24Pct: ages20to24 / 900,
  preferredSidePct: { right:rightPct, left:leftPct, both:bothPct },
  secondaryArchetypePct,
  menAverageHeightCm: avg(batch.players, 'heightCm'),
  menAverageWeightKg: avg(batch.players, 'weightKg'),
  reservedNameRerollTest: rerolled.summary.nameCollisionRerolls,
  samplePlayers: batch.players.slice(0, 5).map((p) => ({
    name:`${p.firstName} ${p.lastName}`,
    category:p.competitionCategory,
    age:p.metadata.entryAge,
    birthplace:`${p.birthplaceCity}, ${p.birthplaceRegionCode ?? p.birthplaceCountryCode}`,
    archetype:p.primaryArchetype,
    preferredSide:p.preferredSide,
    overall:Math.round(p.roleRatings.overall * 100) / 100
  }))
};

console.log(JSON.stringify(summary, null, 2));
console.log('\nMen’s founding-pool player factory validation passed.');
