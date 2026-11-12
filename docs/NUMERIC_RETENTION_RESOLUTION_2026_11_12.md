# Numeric-retention anomaly: cause and laboratory resolution

The v2.0 anomaly is resolved through a protected engine boundary and a qualified research runtime. The installed V8 binary is not patched globally. The v1.0 tournament engine, official state and deployment remain untouched.

## Cause and reproduction

The original raw-return worker was replayed against 32 original fixture seeds, each repeated three times across nine conditions. These 96 diagnostic fixtures are repeated reliability inputs, not 96 independent calibration seeds. All planned diagnostic cases were retained, including failures.

In the default Node v24.22.1 / V8 13.6.233.17-node.58 runtime, one of 864 retained results acquired inconsistent root clocks. In `neutral-7-diag2`, the control initially reported 6,255.360205576988 playing seconds. After subsequent simulations its root value was 4,989.075526462868—the duration of the following confidence condition—while its final event still reported 6,255.360205576988. Elapsed time changed in the same way. Scores, all events, quarters and player/team statistics matched the home-neutralized condition. With Maglev disabled, the same 864 diagnostic results had zero clock inconsistencies.

The installed Node source contains the old Maglev `BuildHeapNumber` implementation that reuses a numeric literal in deoptimization metadata. V8's upstream regression for issue 547819997 fails on this installed binary with Maglev enabled (a separately assigned numeric property reads 3 where 1 is expected), and passes with Maglev disabled. This is the upstream numeric-storage aliasing mechanism, consistent with the captured match failure. Diagnostic instrumentation affected the likelihood of reproducing it; a finite clean batch on the affected optimizer is not evidence that it is safe.

Primary references: [installed Node source](https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/maglev/maglev-code-generator.cc), [V8 fix](https://github.com/v8/v8/commit/7d5eb1df2a721c8fe3aa03b999464c4b86242080), and [upstream regression](https://github.com/v8/v8/blob/7d5eb1df2a721c8fe3aa03b999464c4b86242080/test/mjsunit/maglev/regress-547819997.js). The regression and V8's BSD license are retained in `experiments/v2/fixtures/`.

## Fix

- The public `simulateLabMatch` entry point verifies its root clocks against the final event, captures a detached JSON result and freezes its root before returning. Protection is in the engine API, including for direct callers.
- The worker retains the API's direct return value. It performs no second clone that could conceal a public-boundary regression. After later conditions run, every full result checksum must still match its capture checksum, in addition to clock/statistic/cap checks.
- The research runner starts a child Node process with `--no-maglev` when necessary, verifies the numeric-isolation probe and records the actual runtime flags in the manifest. Workers inherit the qualified parent's flags and verify them. Node rejects explicit V8 flags in `Worker.execArgv`, so qualification happens before workers are created.
- Root clocks are not reconstructed, rounded or normalized to make a check pass. A mismatch aborts research rather than rerolling it.

## Verification

After the fix, the original 32 fixture inputs were repeated three times across all nine conditions in both default and qualified runtimes: 864 retained results per mode, 1,728 results in total. Every complete result—including input, scores, clocks, events, statistics and telemetry—matched exactly across modes. All initial and post-retention checks passed, including the original failing fixture and exact five-loss home neutralization. New-coefficient mechanics, frozen-baseline/legacy checks and small study save/resume checks also passed.

The previous reliability adoption blocker is addressed in this laboratory by these enforced protections and runtime qualification. Removing them requires a patched runtime to pass the probe, retention regression and gameplay equivalence checks. This resolution does not adopt any modifier coefficients or approve deployment.

See [machine-readable evidence](verification/numeric-retention-resolution-2026-11-12.json), [all pre-fix diagnostic clock observations](verification/numeric-retention-diagnostic-2026-11-12.csv.gz), [captured pre-fix failure](verification/numeric-retention-pre-fix-failure-2026-11-12.json.gz), and the [new fixed reduction plan](SHARED_PSYCHOLOGY_REDUCTION_PLAN_2026_11_12.md). The earlier aborted screen and reports remain historical evidence.
