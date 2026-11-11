import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { labRoot, baseline, hash, readJSON, verifyBaseline, verifyImportBoundary, validateFeatures,
  loadEngines, sourceFingerprint, syntheticTeams, inputFor, sportingJSON, auditResult, atomicJSON } from './tools.mjs';

export async function runStudy(options) {
  const { studyId, trials = 4, matchDate = '2026-11-11', teamsFile, enabledFeatures = [], internalValidation = false } = options;
  assert.match(studyId ?? '', /^[a-z0-9][a-z0-9-]{0,79}$/, 'Use a safe study ID');
  assert.ok(studyId !== 'setup-validation-reserved' || internalValidation, 'Study ID is reserved for validation');
  assert.ok(Number.isSafeInteger(trials) && trials >= 2 && trials <= 10000 && trials % 2 === 0,
    'Trials per pairing must be even and between 2 and 10000');
  validateFeatures(enabledFeatures);
  const baselineVerification = verifyBaseline(), isolation = verifyImportBoundary();
  const engines = await loadEngines();
  const inputPath = teamsFile ? path.resolve(teamsFile) : null;
  const rawInput = inputPath ? fs.readFileSync(inputPath, 'utf8') : null;
  const teams = rawInput ? JSON.parse(rawInput) : syntheticTeams(engines);
  assert.ok(Array.isArray(teams) && teams.length >= 2 && teams.length <= 36, 'Supply an array of 2–36 MatchTeam records');
  assert.equal(new Set(teams.map(team => team.id)).size, teams.length, 'Team IDs must be unique');
  assert.equal(new Set(teams.flatMap(team => team.players.map(player => player.id))).size, teams.length * 35,
    'Every team must have 35 uniquely identified players');
  const teamSnapshot = JSON.stringify(teams), sourceSHA256 = sourceFingerprint();
  const fixtures = [];
  for (let a = 0; a < teams.length; a++) for (let b = a + 1; b < teams.length; b++) {
    for (let trial = 0; trial < trials; trial++) {
      const indices = trial % 2 ? [b, a] : [a, b];
      fixtures.push({ id: `${studyId}-${a}-${b}-${trial}`, seed: `century-lab:${studyId}:${a}:${b}:${trial}`,
        pairing: [a, b], indices });
    }
  }
  // Validate every roster and date before reserving the output directory.
  for (const fixture of fixtures.filter((_, index) => index % trials === 0)) {
    engines.validateCompetitiveInput(inputFor(engines, fixture.indices.map(index => teams[index]), fixture.id, fixture.seed, matchDate));
  }
  const manifest = { schema: 'century-engine-lab-study-v1', classification: 'lab-only', studyId,
    experiment: 'baseline-equivalence', releaseLabels: ['v1.0', 'v2.0'],
    replayIdentities: ['0.2.0-availability-candidate', '2.0.0-lab'], baselineCommit: baseline.sourceCommit,
    sourceSHA256, teamSnapshotSHA256: hash(teamSnapshot), rawInputSHA256: rawInput === null ? null : hash(rawInput),
    inputKind: rawInput === null ? 'synthetic-validation-only' : 'user-supplied-roster-copy',
    enabledFeatures, matchDate, trialsPerPairing: trials, fixtures,
    stoppingRule: 'Complete every declared fixture once per engine. No outcome-based resampling or early stopping.',
    seedPolicy: 'Identical seeds and inputs per engine; each pairing has equal simulation-side exposure. Changed decisions may desynchronize later draws.',
    carryover: 'None. Healthy lab availability is pinned independently; no official writes or network requests.',
    comparisonPolicy: 'Ignore only top-level engineVersion and match_start.data.engineVersion; exact JSON equality for everything else.' };
  const dir = path.join(labRoot, 'runs', studyId);
  fs.mkdirSync(dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  if (fs.existsSync(manifestPath)) assert.deepEqual(readJSON(manifestPath), manifest, 'Study inputs/source changed; choose a new study ID');
  else atomicJSON(manifestPath, manifest, true);
  const snapshotPath = path.join(dir, 'teams.json');
  if (fs.existsSync(snapshotPath)) assert.equal(hash(JSON.stringify(readJSON(snapshotPath))), manifest.teamSnapshotSHA256);
  else atomicJSON(snapshotPath, teams, true);
  const records = [];
  let resumedFixtures = 0;
  for (const fixture of fixtures) {
    const input = inputFor(engines, fixture.indices.map(index => teams[index]), fixture.id, fixture.seed, matchDate);
    const inputBefore = JSON.stringify(input);
    const file = path.join(dir, `${fixture.id}.json`);
    let record;
    if (fs.existsSync(file)) {
      record = readJSON(file);
      assert.deepEqual(record.fixture, fixture);
      assert.equal(JSON.stringify(record.baseline.input), inputBefore);
      assert.equal(JSON.stringify(record.candidate.input), inputBefore);
      resumedFixtures++;
    } else {
      record = { fixture, baseline: engines.simulateV1(structuredClone(input)), candidate: engines.simulateV2(structuredClone(input)) };
    }
    assert.equal(record.baseline.engineVersion, manifest.replayIdentities[0]);
    assert.equal(record.candidate.engineVersion, manifest.replayIdentities[1]);
    auditResult(record.baseline, engines); auditResult(record.candidate, engines);
    assert.equal(JSON.stringify(engines.simulateV1(JSON.parse(inputBefore))), JSON.stringify(record.baseline), 'v1.0 full replay failed');
    assert.equal(JSON.stringify(engines.simulateV2(JSON.parse(inputBefore))), JSON.stringify(record.candidate), 'v2.0 full replay failed');
    assert.equal(JSON.stringify(input), inputBefore, 'Study input mutated');
    assert.equal(sportingJSON(record.baseline), sportingJSON(record.candidate), 'No-feature v2.0 differs from frozen v1.0');
    if (!fs.existsSync(file)) atomicJSON(file, record, true);
    records.push({ id: fixture.id, pairing: fixture.pairing, indices: fixture.indices,
      scores: record.baseline.scores, winnerTeamId: teams[fixture.indices[record.baseline.winner]].id,
      playingSeconds: record.baseline.playingSeconds, events: record.baseline.events.length,
      fouls: record.baseline.events.filter(event => event.type === 'foul').length,
      seriousFouls: record.baseline.events.filter(event => event.type === 'foul' && event.data.serious).length,
      baselineResultSHA256: hash(JSON.stringify(record.baseline)), candidateResultSHA256: hash(JSON.stringify(record.candidate)) });
  }
  assert.equal(JSON.stringify(teams), teamSnapshot, 'Roster copies changed during study');
  if (inputPath) assert.equal(fs.readFileSync(inputPath, 'utf8'), rawInput, 'Source roster file changed during study');
  verifyBaseline(); assert.equal(sourceFingerprint(), sourceSHA256, 'Lab source changed during study');
  const summary = { schema: 'century-engine-lab-summary-v1', classification: 'lab-only', studyId,
    status: 'passed', experiment: 'baseline-equivalence', inputKind: manifest.inputKind,
    matchedFixtures: fixtures.length, engineResults: fixtures.length * 2, fullReplays: fixtures.length * 2,
    sportingMismatches: 0, officialWrites: 0, networkRequests: 0, enabledFeatures,
    baselineVerification, isolation, sourceSHA256, teamSnapshotSHA256: manifest.teamSnapshotSHA256,
    interpretation: 'Setup/equivalence verification only. No feature effectiveness, win-rate calibration or official results established.',
    records };
  const summaryPath = path.join(dir, 'summary.json');
  if (fs.existsSync(summaryPath)) assert.deepEqual(readJSON(summaryPath), summary, 'Saved summary differs');
  else atomicJSON(summaryPath, summary, true);
  return { studyId, status: summary.status, matchedFixtures: summary.matchedFixtures, fullReplays: summary.fullReplays,
    sportingMismatches: 0, resumedFixtures, inputKind: manifest.inputKind, output: dir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2), values = {};
  const allowed = new Set(['--study-id', '--trials', '--date', '--teams', '--features']);
  for (let index = 0; index < args.length; index += 2) {
    assert.ok(allowed.has(args[index]) && args[index + 1] && !args[index + 1].startsWith('--'), 'Unknown option or missing value');
    assert.ok(!(args[index] in values), 'Duplicate option'); values[args[index]] = args[index + 1];
  }
  console.log(JSON.stringify(await runStudy({ studyId: values['--study-id'], trials: values['--trials'] === undefined ? 4 : Number(values['--trials']),
    matchDate: values['--date'] ?? '2026-11-11', teamsFile: values['--teams'],
    enabledFeatures: values['--features'] ? values['--features'].split(',') : [] }), null, 2));
}
