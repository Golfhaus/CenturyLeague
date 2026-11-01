import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { DEFAULT_MATCH_CONFIG, MATCH_ENGINE_VERSION } from '../packages/simulation-core/dist/match/index.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../packages/simulation-core/releases/match-engine-v0.1.json', import.meta.url), 'utf8'));
const source = manifest.sourceFiles.map(file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).join('\n');
const actual = createHash('sha256').update(source).digest('hex');
assert.equal(actual, manifest.sourceSHA256,
  'Adopted v0.1 source changed. Review the gameplay version and historical replay compatibility before changing the release manifest.');
assert.equal(MATCH_ENGINE_VERSION, manifest.engineVersion,
  'Engine identity is part of seed construction; renaming it changes simulated matches.');
assert.deepEqual(DEFAULT_MATCH_CONFIG, manifest.defaultConfig, 'Adopted match defaults changed.');
console.log(JSON.stringify({ release: manifest.release, engineVersion: MATCH_ENGINE_VERSION, sourceSHA256: actual,
  sourceFiles: manifest.sourceFiles.length, defaultsVerified: true, status: 'passed' }));
