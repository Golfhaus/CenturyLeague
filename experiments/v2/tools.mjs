import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

export const labRoot = fileURLToPath(new URL('.', import.meta.url));
export const repoRoot = path.resolve(labRoot, '../..');
export const hash = value => createHash('sha256').update(value).digest('hex');
export const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export const baseline = readJSON(path.join(labRoot, 'baseline-lock.json'));
export const featureRegistry = readJSON(path.join(labRoot, 'features.json'));

export function verifyBaseline() {
  for (const entry of baseline.files) {
    const bytes = fs.readFileSync(path.join(repoRoot, entry.path));
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(actual, entry.gitBlobSHA, `Frozen v1.0 source changed: ${entry.path}`);
  }
  const manifest = readJSON(path.join(repoRoot, 'packages/simulation-core/releases/match-engine-v0.1.json'));
  const source = manifest.sourceFiles.map(file => fs.readFileSync(path.join(repoRoot, file), 'utf8')).join('\n');
  assert.equal(hash(source), manifest.sourceSHA256, 'Existing gameplay baseline hash differs');
  return { releaseLabel: 'v1.0', sourceCommit: baseline.sourceCommit, protectedFiles: baseline.files.length,
    gameplaySourceSHA256: manifest.sourceSHA256 };
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

// The lab engine may depend only on this closed set of pure, locked gameplay helpers.
// No operations, result-acceptance, database, scheduler, browser or network modules.
const allowed = new Set([
  'experiments/v2/src/engine.ts',
  'packages/simulation-core/src/match/input.ts',
  'packages/simulation-core/src/match/scoring.ts',
  'packages/simulation-core/src/match/statistics.ts',
  'packages/simulation-core/src/match/types.ts',
  'packages/simulation-core/src/competitive/availability.ts',
  'packages/simulation-core/src/types.ts',
  'packages/simulation-core/src/config.ts',
  'packages/simulation-core/src/random.ts',
  'packages/simulation-core/src/roleRatings.ts'
]);

export function verifyImportBoundary() {
  const visited = new Set();
  function visit(file) {
    const relative = path.relative(repoRoot, file).split(path.sep).join('/');
    assert.ok(allowed.has(relative), `Lab import is outside pure-gameplay allowlist: ${relative}`);
    if (visited.has(relative)) return;
    visited.add(relative);
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|require)\s*\(|\bimport\s*\(/.test(source), `Dynamic/network dependency in ${relative}`);
    for (const match of source.matchAll(/\b(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('.'), `External dependency in ${relative}`);
      visit(path.resolve(path.dirname(file), match[1].replace(/\.js$/, '.ts')));
    }
  }
  visit(path.join(labRoot, 'src/engine.ts'));
  return { pureGameplayFiles: visited.size, officialAcceptanceImports: 0 };
}

export function validateFeatures(ids) {
  assert.ok(Array.isArray(ids) && new Set(ids).size === ids.length, 'Feature list must be a unique array');
  for (const id of ids) {
    const feature = featureRegistry.features.find(feature => feature.id === id);
    assert.ok(feature, `Unknown feature: ${id}`);
    assert.equal(feature.status, 'implemented', `Feature is not implemented: ${id}`);
  }
}

export function buildLab() {
  verifyBaseline();
  verifyImportBoundary();
  const root = path.join(labRoot, 'build');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}\n');
  const files = [...walk(path.join(repoRoot, 'packages/simulation-core/src')),
    ...walk(path.join(labRoot, 'src'))].filter(file => file.endsWith('.ts'));
  for (const file of files) {
    const dest = path.join(root, path.relative(repoRoot, file).replace(/\.ts$/, '.js'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, stripTypeScriptTypes(fs.readFileSync(file, 'utf8'), { mode: 'transform', sourceUrl: file }));
  }
  return root;
}

export async function loadEngines() {
  const root = buildLab();
  const load = relative => import(pathToFileURL(path.join(root, relative)).href);
  const [v1, v2, availability, types, random, scoring, statistics] = await Promise.all([
    load('packages/simulation-core/src/competitive/engine.js'), load('experiments/v2/src/engine.js'),
    load('packages/simulation-core/src/competitive/availability.js'), load('packages/simulation-core/src/types.js'),
    load('packages/simulation-core/src/random.js'), load('packages/simulation-core/src/match/scoring.js'),
    load('packages/simulation-core/src/match/statistics.js')
  ]);
  return { simulateV1: v1.simulateCompetitiveMatch, simulateV2: v2.simulateLabMatch,
    ...availability, ...types, ...random, ...scoring, ...statistics };
}

export function sourceFingerprint() {
  const files = walk(labRoot).filter(file => !file.startsWith(path.join(labRoot, 'build') + path.sep) &&
    !file.startsWith(path.join(labRoot, 'runs') + path.sep) && !file.endsWith('/validation.json')).sort();
  return hash(JSON.stringify(files.map(file => [path.relative(labRoot, file), hash(fs.readFileSync(file))])));
}

export function syntheticTeams({ ATTRIBUTE_KEYS, createRandom }) {
  const rng = createRandom('century-v2-lab-synthetic-population-1');
  return ['LAB-A', 'LAB-B', 'LAB-C'].map(id => ({ id, name: `Synthetic ${id}`,
    coach: { name: 'Synthetic neutral coach', tactics: Object.fromEntries([
      'tempo', 'physicality', 'defensive_posture', 'pressure', 'transition_emphasis', 'width',
      'aerial_emphasis', 'ball_risk', 'running_movement_emphasis', 'defensive_aggression'].map(key => [key, 3])) },
    players: Array.from({ length: 35 }, (_, index) => ({ id: `${id}-${index}`, name: `Synthetic player ${id}-${index}`,
      ratings: Object.fromEntries(ATTRIBUTE_KEYS.map(key => [key, Math.max(1, Math.min(20, 11 + rng.normal(0, 1.5)))])) })) }));
}

export function inputFor(engines, teams, id, seed, matchDate) {
  const input = { id, seed, teams: structuredClone(teams), provenance: { classification: 'lab-only', releaseLabel: 'v2.0' } };
  return { ...input, availability: engines.pinAvailability(input, 'men', matchDate, [], []) };
}

// Ignore ONLY the top-level version and match_start.data.engineVersion.
// Inputs and every sporting event/statistic remain byte-identical JSON.
export function sportingJSON(result) {
  return JSON.stringify({ ...result, engineVersion: 'comparison-only', events: result.events.map(event =>
    event.type === 'match_start' ? { ...event, data: { ...event.data, engineVersion: 'comparison-only' } } : event) });
}

export function auditResult(result, engines) {
  assert.equal(result.status, 'complete');
  const starts = result.events.filter(event => event.type === 'match_start');
  assert.equal(starts.length, 1);
  assert.equal(starts[0].data.engineVersion, result.engineVersion);
  assert.equal(result.scores[result.winner], 100);
  assert.ok(result.scores[1 - result.winner] < 100);
  assert.equal(result.quarters.length, 4);
  for (const side of [0, 1]) {
    assert.equal(result.players.filter(player => player.side === side).reduce((sum, player) => sum + (player.stats.points ?? 0), 0), result.scores[side]);
    assert.equal(result.teamStats[side].points, result.scores[side]);
    assert.equal(result.quarters.reduce((sum, quarter) => sum + quarter.points[side], 0), result.scores[side]);
  }
  assert.deepEqual(engines.projectStatistics(result.input, result.events), { players: result.players, teamStats: result.teamStats });
  const winner = result.events.filter(event => event.type === 'score' && event.data.winning);
  assert.equal(winner.length, 1);
  assert.equal(winner[0].data.kind, 'central_air');
  assert.equal(result.events.findLast(event => event.type === 'score').id, winner[0].id);
  for (let index = 0; index < 3; index++) assert.ok(Math.max(...result.quarters[index].cumulative) >= 25 * (index + 1));
}

export function atomicJSON(file, value, exclusive = false) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  try {
    if (exclusive) fs.linkSync(tmp, file);
    else fs.renameSync(tmp, file);
  } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
