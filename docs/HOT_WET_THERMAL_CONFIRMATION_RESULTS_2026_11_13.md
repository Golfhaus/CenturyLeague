# Hot/wet thermal confirmation — completed 2026-11-13

Lab only; no coefficient adoption or official competition writes. Fixed plan: `HOT_WET_THERMAL_CONFIRMATION_PLAN_2026_11_13.md`.

All 3,200 fresh matched fixtures and 19,200 outcomes completed: eight unchanged copied founding profiles, 400 trials each, balanced simulation sides. No screen seeds were reused or pooled. Source SHA-256: `37ee2b4cf2af55d113806ab76d74a37fd941f0a3a8cb4a6448fb19c3b338c311`. Weather, thermal moderation (0.5) and psychology coefficients remained unchanged.

| Contrast | Earlier 512-fixture screen, points | Fresh confirmation, points | Conservative paired 95% interval |
| --- | ---: | ---: | --- |
| Adverse thermal traits minus shared hot/wet weather (primary) | -10.74 | -7.94 | -11.30 to -4.55 |
| Favored thermal traits minus shared hot/wet weather | +7.81 | +7.59 | +4.22 to +10.94 |
| Full favored combination minus calm control | +11.33 | +9.66 | +6.32 to +12.96 |
| Full adverse combination minus calm control | -9.57 | -11.09 | -14.47 to -7.68 |

The primary comparison had 650 improved and 904 worsened paired winners; mean score-margin change -4.664375 points. Both thermal directions are supported at their nominal per-contrast level, but their magnitudes relative to the approximate eight-point review level remain unresolved. There is no statistical contradiction with the earlier screen.

The calm control won 1,632/3,200 (51.00%); shared hot/wet won 1,598 (49.94%); full favored won 1,941 (60.66%); full adverse won 1,277 (39.91%). The favored corner still lost 1,259 matches (39.34%). Observed results do not establish a universal ceiling.

Adding psychology at identical favored weather/traits added 3.125 points (0.4914 to 5.7488); the adverse increment was -2.09375 (-4.6531 to +0.4721). Keep psychology unchanged for the next study. Shared weather alone versus calm was -1.0625 (-4.4728 to +2.3512). Mean playing duration changed from 82.6532 to 92.3533 minutes; scoring pace changed from 2.1857 to 1.9597 points per playing minute.

## Decision

Test a modest thermal-only reduction before adoption. The physical estimates sit close to the approximate eight-point review level, their intervals extend beyond it, and the adverse combined point estimate remains beyond the preferred ten-point level. This recommendation seeks design headroom; it is not proof that the true thermal effect exceeds eight points. Do not change coefficients based on this completed study's outcomes and then reuse its seeds as fresh confirmation.

Also recheck Philadelphia–Norfolk on fresh matched seeds. Exploratory club-level combined point estimates above the fifteen-point review level were Norfolk favored +15.50, Hagerstown adverse -15.25 and Philadelphia adverse -19.75. Philadelphia's shared-weather-only contrast was -11.75 (-21.17 to -2.04), so its total cannot be assigned entirely to thermal traits or psychology. The profile intervals are wide and not simultaneous; these flags do not establish a coding defect or a league-wide bound.

## Reliability and preservation

- Forty-eight selected screened full-result hashes reproduced exactly; all six-arm save/resume and corruption checks passed on 96 outcomes.
- Every confirmation outcome passed clock, score, statistics, immutable-input and psychological-cap checks. Forty-eight first-fixture outcomes were fully replayed; eight controls were checked against frozen v1.0. No resumed or discarded fixtures.
- Final source lock and all 64 protected v1.0 files passed. A clean checkout plus the saved source patch reproduced the exact running lab hash.
- Independent Python calculations from the 19,200-row compact CSV reproduced all contrasts and counts.
- Sixteen full-ledger parts preserve every input/event; byte hashes and every gzip stream/CRC were checked. The compact bundle includes the plan, both separate studies' estimates, reproducibility patch, profiles, independent calculations and full-ledger checksum index.

Planning metadata clarification: the generic runner's locked manifest retains an earlier psychology planning value `0.324`. The correct primary hot/wet screening discordance is 249/512 = 0.486328125. This stale field is nonoperative: the 3,200-fixture plan was fixed before execution, and all reported intervals use actual confirmation counts. The original manifest remains unchanged for replay.
