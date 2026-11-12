# Larger confidence study: five wins versus three

**The active tournament remains v1.0. No candidate coefficients, v2.0 gameplay source, official records, deployments or scheduler settings changed.**

## Prespecified design

This is a fresh sample of 6,400 independent matched fixture seeds, split equally between the same neutral and higher-pressure synthetic mirror-roster profiles. Each seed was run under control, three-win confidence and five-win confidence, for 19,200 engine results. Each profile had 1,600 fixtures in each simulation-side assignment. Earlier studies were not pooled into this sample.

The primary endpoint and sample size were committed before the run. Every scheduled fixture was retained, with no outcome-dependent stopping, resampling or coefficient changes. The primary interval is the prespecified large-sample paired mean interval; it estimates five-win minus three-win win probability. Secondary controls and profile results do not replace that endpoint.

## Results

| Condition | Wins out of 6,400 | Win rate | Average scoring margin |
| --- | ---: | ---: | ---: |
| No confidence | 3,269 | 51.08% | +0.489 points |
| Three consecutive wins | 3,505 | 54.77% | +2.560 points |
| Five consecutive wins | 3,755 | 58.67% | +4.481 points |

**Five-win minus three-win confidence: +3.91 percentage points**, with a prespecified approximate 95% interval of **+2.52 to +5.29 points**.

Among matched fixtures, 1,157 winners improved from a focal loss to a win, 907 changed from a win to a loss, and 4,336 winners stayed the same. The mean paired scoring-margin difference was +1.921 points.

The larger fresh sample supports a higher win probability at five wins than at three in these tested profiles. The earlier one-win decline is consistent with sampling noise; it is not reproduced as a reliable reversal.

## Tactical profiles

These are secondary exploratory estimates. They describe the two tested contexts, not all possible coaches or rosters.

| Profile | Five-minus-three win difference | Approximate paired 95% interval |
| --- | ---: | --- |
| neutral | +4.44 points | +2.48 to +6.40 points |
| pressure | +3.38 points | +1.41 to +5.34 points |

## Calibration implication

The three-win arm was **+3.69 percentage points** above control; the five-win arm was **+7.59 points** above control. The three-win estimate fits the earlier 2–4 point design target, while the five-win cap may be stronger than the intended subtle effect. Review that upper cap, and later its interaction with home support, before official adoption; no coefficient was changed in this study.

## Verification and limits

Every result passed scoring, quarter, winning-kick and player/team statistic reconciliation. The run fully replayed 6 prespecified results and checked 2 controls against v1.0. All saved results would be fully replayed on resumption. Independent report verification reconciled all 19,200 compact rows and recalculated the primary interval from discordant outcomes.

Both the v2.0 engine and streak-helper file hashes match the earlier candidate. The 64-file v1.0 baseline lock was checked before and after execution. No stored player ratings were modified. Synthetic mirror copies are controlled test opponents, not real-club performance forecasts.

Candidate/test-harness source commit: `d4fab747869326d738b136dc24f42e2ac521e8a1`. Laboratory source fingerprint: `e35b5a67562e81a2cab008c6307466bdd7642fa2355af730233facfefc4bbd44`. Runtime: `{"arch": "x64", "node": "v24.22.1", "platform": "linux", "v8": "13.6.233.17-node.58"}`.

Confidence still modifies selected execution odds by 1% at three wins and 2% at five or more wins; neither coefficient was adjusted. Frustration, home support, weather and halftime adaptation were excluded from this study. Its result addresses the confidence curve in these two profiles, not interactions with the other proposed features.

A statistical difference does not by itself approve the size of the final effect. Official adoption remains a separate commissioner decision after the inaugural tournament.

See [aggregate evidence](verification/confidence-precision-2026-11-11.json), the [compact research archive](verification/confidence-precision-2026-11-11.tar.gz), and the [prespecified plan](CONFIDENCE_PRECISION_PLAN_2026_11_11.md).

Reproduce from the pinned source commit and runtime:

```bash
node experiments/v2/run-streaks.mjs --study-id confidence-precision-001 --arms confidence --trials 3200 --workers 8
```
