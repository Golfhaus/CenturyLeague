import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { Worker } from 'node:worker_threads';
import { loadEngines, repoRoot, readJSON } from './tools.mjs';
import { numericIsolationProbe } from './runtime.mjs';

const evidence = readJSON(path.join(repoRoot, 'docs/verification/shared-psych-screen-001-abort.json'));
const m = evidence.manifest, originals = m.fixtures.slice(0, 32);
assert.ok(originals.some(f => f.id === evidence.failedFixture.id));
const fixtures = originals.flatMap(f => Array.from({ length: 3 }, (_, rep) => ({ ...f, id: f.id + '-diag' + rep })));

async function checkMode(dir) {
  fs.mkdirSync(dir);
  const pool = []; let next = 0, finished = 0;
  try {
    await new Promise((resolve, reject) => {
      for (let i = 0; i < 8; i++) {
        // V8 flags are inherited from this mode's parent, never Worker.execArgv.
        const worker = new Worker(new URL('./streak-worker.mjs', import.meta.url), {
          workerData: { dir, profiles: m.profiles, arms: m.arms, matchDate: m.matchDate,
            confidenceScale: .35, sharedPolicy: m.coefficients.sharedPsychology, requiredExecArgv: process.execArgv }
        });
        pool.push(worker);
        worker.on('error', reject);
        worker.on('exit', code => { if (code !== 0 && finished < fixtures.length) reject(Error(`Worker exited ${code}`)); });
        worker.on('message', result => {
          if (result.error) { reject(Error(`${result.fixtureId}: ${result.error}`)); return; }
          if (++finished === fixtures.length) resolve();
          else if (next < fixtures.length) worker.postMessage(fixtures[next++]);
        });
        worker.postMessage(fixtures[next++]);
      }
    });
    return { fixtures: finished, results: finished * m.arms.length, workerExecArgv: process.execArgv };
  } finally { await Promise.all(pool.map(worker => worker.terminate())); }
}

if (process.argv[2] === '--mode') {
  const checked = await checkMode(process.argv[3]);
  console.log(JSON.stringify(checked));
} else {
  const vulnerable = numericIsolationProbe(true), qualified = numericIsolationProbe(false);
  assert.ok(qualified.passed, qualified.stderr || qualified.error);
  assert.ok(vulnerable.passed || vulnerable.stderr.includes('AssertionError'), 'Unexpected upstream probe error');
  await loadEngines();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'century-psych-retention-'));
  const modes = [];
  try {
    for (const [name, flags] of [['default', []], ['qualified', ['--no-maglev']]]) {
      const run = spawnSync(process.execPath, [...flags, fileURLToPath(import.meta.url), '--mode', path.join(dir, name)], { encoding: 'utf8' });
      assert.equal(run.status, 0, run.stderr || run.error?.message);
      modes.push({ mode: name, ...JSON.parse(run.stdout) });
    }
    for (const fixture of fixtures) {
      const name = fixture.id + '.json.gz';
      assert.equal(gunzipSync(fs.readFileSync(path.join(dir, 'default', name))).toString(),
        gunzipSync(fs.readFileSync(path.join(dir, 'qualified', name))).toString(), 'Runtime mode changed a complete result');
    }
    console.log(JSON.stringify({ status: 'passed', node: process.version, v8: process.versions.v8,
      originalFixtures: originals.length, includesOriginalFailure: true, modes,
      upstreamProbeWithMaglev: vulnerable.passed ? 'passed-on-this-runtime' : 'reproduced-upstream-aliasing-defect',
      upstreamProbeWithoutMaglev: 'passed', exactCrossRuntimeResults: fixtures.length * m.arms.length,
      checks: ['public engine returns retained directly', 'clock/event agreement', 'quarter playing totals', 'full post-retention hashes', 'zero home equivalence', 'default/qualified exact equality'] }));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
