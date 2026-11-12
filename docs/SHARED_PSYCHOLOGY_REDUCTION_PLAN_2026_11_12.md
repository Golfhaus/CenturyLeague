# Second psychological candidate: fixed reduction study

This is isolated v2.0 research. v1.0, official state, defaults, deployment and tournament operations remain unchanged. Neither the old nor the new coefficients are adopted.

## Decision made before the new studies

The first confirmation estimated +4.59 percentage points for five-win confidence and +4.79 points for the maximum psychological stack versus its control. Its uncertainty did not establish the proposed three-/four-point review levels as safe ceilings. Lowering confidence alone would leave the saturated shared stack unchanged.

The new explicit `reduced-020` runner candidate sets confidence scale to **0.20** and the shared per-club action-odds cap to **0.006**. Home support remains **0.004**, with the same crowd curve, neutral venues and five-loss neutralization. Frustration remains at scale 1. The previous `first-035` configuration is still selectable and historical reports are retained.

Five-win confidence therefore contributes 0.40% odds rather than 0.70%; peak home support stays 0.52%. Their uncapped combination is 0.92208%, bounded to 0.60% rather than 0.90%. No action, score or match winner is forced. This cap is not a match win-probability ceiling.

## Fixed samples

1. `shared-psych-reduced-screen-001`: 64 side-balanced seeds per neutral/pressure synthetic mirror profile, nine conditions, 128 matched fixtures and **1,152 results**. This checks the confidence curve, ordinary/hot/neutralized home support, combined support/frustration and the adverse stack.
2. `shared-psych-reduced-confirm-001`: 3,200 side-balanced seeds per profile, **6,400 fresh matched fixtures**. Four conditions—control, five-win confidence, hot five-win home support alone, and the maximum psychological stack—produce **25,600 results**. The isolated home condition is included because its earlier small screening estimate cannot establish calibration.

The primary contrast is maximum stack minus control on the same fixtures. Confidence and home alone versus control and tactical-profile contrasts are secondary. Report raw wins, paired score margins, foul denominators, cap saturation, ordinary paired approximate 95% intervals and conservative Wilson-combination paired intervals. The planning discordance estimate 0.324 gives an ordinary paired half-width near 1.4 percentage points at 6,400 seeds; actual precision can differ. This is not a universal ceiling certification or a survey of all roster types.

Complete every fixture/condition; no outcome-dependent stopping, discarded results, coefficient changes or extra samples. Screening is not pooled into confirmation. New seeds/IDs are independent of previous calibration samples. Review levels stay at three points for confidence/home and four for combined psychology; report uncertainty rather than treating a point estimate as proof.

## Reliability prerequisite

The return-retention anomaly is addressed before calibration: public engine results are detached snapshots with frozen roots; the engine rejects clocks inconsistent with the final event. The worker directly retains that public result and checks its full checksum again after every condition. Research workers explicitly disable Maglev and must pass the upstream numeric-isolation probe. The original 32 fixtures are repeated three times across nine conditions in both default and qualified runtimes; complete results must agree exactly across modes. Preserve the pre-fix failure, optimizer-on/off comparison and upstream probe evidence separately from calibration.

Run the fixed studies only after reliability, legacy and new-policy checks pass. Record runtime flags, source commit/fingerprint, all inputs and all outcomes. A technical failure aborts the study and is documented; never silently reroll it.

```bash
node experiments/v2/validate-psychology-retention.mjs
node experiments/v2/validate-psychology.mjs
node experiments/v2/run-streaks.mjs --study-id shared-psych-reduced-screen-001 --arms psychology --psychology-candidate reduced-020 --trials 64 --workers 8 --date 2026-11-12
node experiments/v2/run-streaks.mjs --study-id shared-psych-reduced-confirm-001 --arms psychology-calibration --psychology-candidate reduced-020 --trials 3200 --workers 8 --date 2026-11-12
```

Weather, temperature traits and halftime adaptation are still outside this study. Adoption remains a separate decision after the inaugural tournament and explicit commissioner approval.
