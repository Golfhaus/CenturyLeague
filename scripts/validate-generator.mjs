import { validateGeneratedPopulation } from '../packages/simulation-core/dist/index.js';

const summary = validateGeneratedPopulation(10_000, 'ci-validation');

console.log(JSON.stringify(summary, null, 2));

const failures = [];

if (summary.overallMean < 10.0 || summary.overallMean > 12.5) {
  failures.push(`Overall mean out of range: ${summary.overallMean}`);
}

for (const [attribute, mean] of Object.entries(summary.attributeMeans)) {
  if (mean < 9.5 || mean > 11.5) {
    failures.push(`Attribute mean out of range: ${attribute}=${mean}`);
  }
}

if (summary.secondaryArchetypePercent < 37 || summary.secondaryArchetypePercent > 43) {
  failures.push(`Secondary-archetype rate out of range: ${summary.secondaryArchetypePercent}%`);
}

if (summary.offProfileGiftPercent < 4 || summary.offProfileGiftPercent > 6) {
  failures.push(`Off-profile gift rate out of range: ${summary.offProfileGiftPercent}%`);
}

if (summary.extremeOutlierPercent < 0.4 || summary.extremeOutlierPercent > 1.1) {
  failures.push(`Extreme-outlier rate out of range: ${summary.extremeOutlierPercent}%`);
}

if (failures.length) {
  console.error('\nGenerator validation failed:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('\nGenerator validation passed.');
