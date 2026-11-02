import { simulateMatch } from '../match/engine.ts';
import type { MatchResult } from '../match/types.ts';

export const EXACT_REPLAY_POLICY = 'century-replay-exact-v1';
export const COORDINATE_REPLAY_POLICY = 'century-replay-coordinate-v1';
export type ReplayPolicy = typeof EXACT_REPLAY_POLICY | typeof COORDINATE_REPLAY_POLICY;
export interface ReplayReport {
  policy: ReplayPolicy; equivalent: boolean; exact: boolean;
  coordinateDifferences: number; maxCoordinateDelta: number; maxCoordinateULPs: number;
  firstMismatch: string | null;
}

/** Compare persisted JSON without changing it. Only the explicitly named lateral
 * event coordinates may round: both <= 8 binary64 steps AND <= 1e-12 metres.
 * Every other field, including input coordinates, remains exact. */
export function compareMatchReplay(saved: MatchResult, replay: MatchResult, policy: ReplayPolicy = EXACT_REPLAY_POLICY): ReplayReport {
  if (policy !== EXACT_REPLAY_POLICY && policy !== COORDINATE_REPLAY_POLICY) throw new Error('Unknown replay policy');
  const report: ReplayReport = { policy, equivalent: true, exact: true, coordinateDifferences: 0,
    maxCoordinateDelta: 0, maxCoordinateULPs: 0, firstMismatch: null };
  const bits = new DataView(new ArrayBuffer(8));
  const ordered = (n: number): bigint => {
    bits.setFloat64(0, n);
    const value = bits.getBigUint64(0);
    return value >> 63n ? ~value : value | (1n << 63n);
  };
  const mismatch = (path: string): void => { report.equivalent = false; report.firstMismatch ??= path || '$'; };
  const walk = (a: unknown, b: unknown, path: string): void => {
    // Reject non-JSON numbers before serialization can turn them into null.
    if ((typeof a === 'number' && !Number.isFinite(a)) || (typeof b === 'number' && !Number.isFinite(b))) { mismatch(path); return; }
    if (a === b && (a === null || typeof a !== 'object')) return;
    if (typeof a === 'number' && typeof b === 'number') {
      const coordinate = /^events\.\d+\.(y|data\.targetY)$/.test(path);
      if (policy === COORDINATE_REPLAY_POLICY && coordinate && a >= 0 && b >= 0 &&
          a <= saved.config.fieldWidth && b <= saved.config.fieldWidth) {
        const delta = Math.abs(a-b), left = ordered(a), right = ordered(b), ulps = left > right ? left-right : right-left;
        if (delta <= 1e-12 && ulps <= 8n) {
          report.coordinateDifferences++;
          report.maxCoordinateDelta = Math.max(report.maxCoordinateDelta, delta);
          report.maxCoordinateULPs = Math.max(report.maxCoordinateULPs, Number(ulps));
          return;
        }
      }
      mismatch(path); return;
    }
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) { mismatch(path); return; }
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) { mismatch(path+'.length'); return; }
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    // Undefined object properties are omitted by the existing JSON persistence contract.
    const keysA = Object.keys(left).filter(k => left[k] !== undefined).sort();
    const keysB = Object.keys(right).filter(k => right[k] !== undefined).sort();
    if (JSON.stringify(keysA) !== JSON.stringify(keysB)) { mismatch(path); return; }
    for (const key of keysA) walk(left[key], right[key], path ? `${path}.${key}` : key);
  };
  walk(saved, replay, '');
  report.exact = report.equivalent && report.coordinateDifferences === 0;
  return report;
}

export function verifyMatchReplay(result: MatchResult, policy: ReplayPolicy = EXACT_REPLAY_POLICY): ReplayReport {
  return compareMatchReplay(result, simulateMatch(result.input), policy);
}
