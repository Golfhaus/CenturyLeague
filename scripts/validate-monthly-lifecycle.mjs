import assert from 'node:assert/strict';
import {
  DEVELOPMENT_MODEL_VERSION,
  INAUGURAL_EVENT_NAME,
  INAUGURAL_SEASON_START,
  annualRetirementProbability,
  generateBirthDateForEntryAge,
  integerAgeOnDate,
  retirementProbability,
  seasonCalendarEntry
} from '../packages/simulation-core/dist/index.js';

assert.equal(DEVELOPMENT_MODEL_VERSION, '1.1.0');

const s1 = seasonCalendarEntry(1);
assert.equal(s1.startsOn, '2026-11-01');
assert.equal(s1.endsOn, '2026-11-30');
assert.equal(s1.eventName, INAUGURAL_EVENT_NAME);

const s2 = seasonCalendarEntry(2);
assert.equal(s2.startsOn, '2026-12-01');
assert.equal(s2.endsOn, '2026-12-31');

const s3 = seasonCalendarEntry(3);
assert.equal(s3.startsOn, '2027-01-01');
assert.equal(s3.endsOn, '2027-01-31');

for (const age of [16, 18, 22, 26]) {
  for (let i = 0; i < 100; i += 1) {
    const dob = generateBirthDateForEntryAge(age, INAUGURAL_SEASON_START, `age-${age}-${i}`);
    assert.equal(integerAgeOnDate(dob, INAUGURAL_SEASON_START), age);
  }
}

const retirementInputs = {
  ageYears: 36.5,
  peakOverall: 15.5,
  currentOverall: 12.5,
  longevity: 9,
  recovery: 8,
  retirementTendency: 11
};

const annual = annualRetirementProbability(retirementInputs);
const monthly = retirementProbability(retirementInputs, 1);
const compounded = 1 - Math.pow(1 - monthly, 12);
assert.ok(Math.abs(compounded - annual) < 1e-12);

console.log(JSON.stringify({
  developmentModel: DEVELOPMENT_MODEL_VERSION,
  inauguralSeason: s1,
  nextSeason: s2,
  annualRetirementProbability: annual,
  monthlyRetirementProbability: monthly,
  compoundedTwelveMonthProbability: compounded
}, null, 2));

console.log('\nMonthly lifecycle validation passed.');
