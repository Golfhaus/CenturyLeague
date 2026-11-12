import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const studyWorkerExecArgv = ['--no-maglev'];
const maglevFlag = /^--(?:no-)?maglev(?:=|$)/;
export function ensureQualifiedStudyProcess() {
  if (process.execArgv.filter(flag => maglevFlag.test(flag)).at(-1) === '--no-maglev') return;
  // Node rejects V8 flags in Worker.execArgv. Start a qualified parent so its
  // workers inherit the flag; no process-wide V8 settings are changed in place.
  const run = spawnSync(process.execPath, [...process.execArgv.filter(flag => !maglevFlag.test(flag)),
    ...studyWorkerExecArgv, ...process.argv.slice(1)], { stdio: 'inherit' });
  if (run.error) throw run.error;
  process.exit(run.status ?? 1);
}
export function numericIsolationProbe(maglev = false) {
  const run = spawnSync(process.execPath, ['--allow-natives-syntax', maglev ? '--maglev' : '--no-maglev',
    fileURLToPath(new URL('./fixtures/number-retention-probe.cjs', import.meta.url))], { encoding: 'utf8' });
  return { status: run.status, signal: run.signal, passed: run.status === 0,
    stdout: run.stdout, stderr: run.stderr, error: run.error?.message };
}
export function qualifyStudyRuntime() {
  assert.equal(process.execArgv.filter(flag => maglevFlag.test(flag)).at(-1), '--no-maglev', 'Study parent must disable Maglev before creating workers');
  const probe = numericIsolationProbe();
  assert.ok(probe.passed, `Qualified study runtime failed numeric isolation: ${probe.stderr || probe.error}`);
  return { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch,
    workerExecArgv: [...process.execArgv], numericIsolationProbe: 'passed', publicResultBoundary: 'detached-json-snapshot-frozen-root-v1' };
}
