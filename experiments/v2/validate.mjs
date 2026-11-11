import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { labRoot, verifyBaseline, verifyImportBoundary, validateFeatures, loadEngines,
  syntheticTeams, inputFor, auditResult, sportingJSON } from './tools.mjs';
import { runStudy } from './run.mjs';

const baseline = verifyBaseline(), isolation = verifyImportBoundary();
validateFeatures([]);
assert.throws(() => validateFeatures(['confidence']), /not implemented/);
assert.throws(() => validateFeatures(['unknown']), /Unknown feature/);
const engines = await loadEngines(), teams = syntheticTeams(engines);
const input = inputFor(engines, teams.slice(0, 2), 'lab-validation', 'lab-validation-1', '2026-11-11');
const original = JSON.stringify(input);
const v1 = engines.simulateV1(input), v2 = engines.simulateV2(input);
assert.equal(v1.engineVersion, '0.2.0-availability-candidate');
assert.equal(v2.engineVersion, '2.0.0-lab');
assert.equal(sportingJSON(v1), sportingJSON(v2));
assert.equal(JSON.stringify(input), original);
assert.equal(JSON.stringify(engines.simulateV2(JSON.parse(original))), JSON.stringify(v2));
auditResult(v1, engines); auditResult(v2, engines);
const unavailable = structuredClone(input);
const missing = unavailable.availability.players[0];
missing.eligible = false; missing.injuryIds = ['synthetic-lab-injury'];
const unavailableV1 = engines.simulateV1(unavailable), unavailableV2 = engines.simulateV2(unavailable);
assert.equal(sportingJSON(unavailableV1), sportingJSON(unavailableV2));
assert.ok(!unavailableV2.events.some(event => event.playerId === missing.playerId || event.otherPlayerId === missing.playerId ||
  (event.type === 'lineup' && event.data.playerIds.includes(missing.playerId))));
const impossible = structuredClone(input);
for (const player of impossible.availability.players.slice(0, 21)) {
  player.eligible = false; player.injuryIds = ['synthetic-lab-injury'];
}
assert.throws(() => engines.simulateV2(impossible), /Fewer than 15/);
const changedSeed = engines.simulateV2({ ...input, seed: 'lab-validation-2' });
assert.notEqual(JSON.stringify(changedSeed.events), JSON.stringify(v2.events));
// Exercise score capping and the qualifying winning kick with unchanged helpers.
for (let score = 0; score < 100; score++) for (const kind of ['central_air', 'central_bounce', 'outer_air', 'outer_deflection', 'bonus']) {
  const result = engines.resolveScore({ scores: [score, 99], bonuses: [[], []], winner: null }, 0, 'synthetic', kind, 1);
  assert.ok(result.state.scores[0] <= 100);
  assert.equal(result.winning, kind === 'central_air' && score >= 96);
}

// Only delete this validator's reserved local directory, never a study chosen by a user.
const studyId = 'setup-validation-reserved', dir = path.join(labRoot, 'runs', studyId);
fs.rmSync(dir, { recursive: true, force: true });
const first = await runStudy({ studyId, internalValidation: true, trials: 4 });
const manifestFile = path.join(dir, 'manifest.json'), manifest = fs.readFileSync(manifestFile, 'utf8');
const second = await runStudy({ studyId, internalValidation: true, trials: 4 });
assert.equal(second.resumedFixtures, first.matchedFixtures);
assert.equal(fs.readFileSync(manifestFile, 'utf8'), manifest);
await assert.rejects(runStudy({ studyId, internalValidation: true, trials: 2 }), /Study inputs\/source changed/);
await assert.rejects(runStudy({ studyId: 'setup-validation-reserved', trials: 2 }), /reserved/);
await assert.rejects(runStudy({ studyId: '../escape', trials: 2 }), /safe study ID/);
await assert.rejects(runStudy({ studyId: 'unimplemented', enabledFeatures: ['weather'] }), /not implemented/);
// A corrupt saved event ledger must be rejected, not silently rerolled.
const fixtureFile = path.join(dir, `${JSON.parse(manifest).fixtures[0].id}.json`);
const fixtureText = fs.readFileSync(fixtureFile, 'utf8');
const corrupt = JSON.parse(fixtureText); corrupt.candidate.events[0].type = 'corrupt';
fs.writeFileSync(fixtureFile, JSON.stringify(corrupt));
await assert.rejects(runStudy({ studyId, internalValidation: true, trials: 4 }));
fs.writeFileSync(fixtureFile, fixtureText);
const baselineFile = path.resolve(labRoot, '../../packages/simulation-core/src/match/engine.ts');
const baselineBytes = fs.readFileSync(baselineFile);
try {
  fs.appendFileSync(baselineFile, '\n// synthetic tamper test\n');
  assert.throws(() => verifyBaseline(), /Frozen v1.0 source changed/);
} finally { fs.writeFileSync(baselineFile, baselineBytes); }
verifyBaseline();
console.log(JSON.stringify({ status: 'passed', releaseLabels: ['v1.0', 'v2.0'], baseline, isolation,
  matchedFixtures: first.matchedFixtures, engineResults: first.matchedFixtures * 2,
  fullReplaysPerPass: first.fullReplays, exactResumeVerified: true, corruptLedgerRejected: true,
  baselineTamperingRejected: true, unavailablePlayersExcluded: true, scoreTransitionsChecked: 500,
  unimplementedFeaturesRejected: true, officialWrites: 0, networkRequests: 0,
  interpretation: 'Synthetic setup checks only; no modifier effects or official matches simulated.' }, null, 2));
