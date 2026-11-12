import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { loadEngines, repoRoot, readJSON } from './tools.mjs';

// Preserve the original inputs, including the observed failure, without reusing
// the aborted sample for calibration or resuming its result directory.
const evidence = readJSON(path.join(repoRoot, 'docs/verification/shared-psych-screen-001-abort.json'));
const m = evidence.manifest, fixtures = m.fixtures.slice(0, 32);
assert.ok(fixtures.some(f => f.id === evidence.failedFixture.id));
await loadEngines();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'century-psych-retention-'));
const pool = []; let next = 0, finished = 0;
try {
  await new Promise((resolve, reject) => {
    for (let i = 0; i < 8; i++) {
      const worker = new Worker(new URL('./streak-worker.mjs', import.meta.url), {
        workerData: { dir, profiles: m.profiles, arms: m.arms, matchDate: m.matchDate,
          confidenceScale: .35, sharedPolicy: m.coefficients.sharedPsychology }
      });
      pool.push(worker);
      worker.on('error', reject);
      worker.on('message', result => {
        if (result.error) { reject(Error(`${result.fixtureId}: ${result.error}`)); return; }
        if (++finished === fixtures.length) resolve();
        else if (next < fixtures.length) worker.postMessage(fixtures[next++]);
      });
      worker.postMessage(fixtures[next++]);
    }
  });
  console.log(JSON.stringify({ status: 'passed', originalFixtures: finished,
    retainedResults: finished * m.arms.length, includesObservedFailure: true,
    checks: ['clock/event agreement', 'quarter playing totals', 'post-retention audit', 'zero home equivalence'] }));
} finally {
  await Promise.all(pool.map(worker => worker.terminate()));
  fs.rmSync(dir, { recursive: true, force: true });
}
