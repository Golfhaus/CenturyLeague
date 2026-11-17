# Thermal reduction and Philadelphia–Norfolk recheck results

Lab only, completed 2026-11-13. The fixed plan is `THERMAL_REDUCTION_AND_MATCHUP_RECHECK_PLAN_2026_11_13.md`. No adoption, v1.0 changes, official history writes or external publication.

Completed all 1,600 candidate-screen fixtures (16,000 outcomes), plus 800 independent matchup-recheck fixtures (1,600 outcomes). No earlier seeds were reused or pooled. Scientific source SHA-256: `3111164943d3f84f299af68baba8dc77e352db3ac9b315ee9fbc82a00ef698c1`.

## Candidate screen

Moderation 0.35 was compared directly with 0.50 on the same fresh fixtures, with every other weather and psychological coefficient unchanged. Both are laboratory hypotheses; 0.50 remains the default.

| Contrast | Original 0.50, points | Reduced 0.35, points | Reduced conservative 95% interval |
| --- | ---: | ---: | --- |
| Extreme adverse traits minus identical shared weather | -10.31 | -7.13 | -11.88 to -2.33 |
| Extreme favored traits minus identical shared weather | +8.38 | +3.75 | -1.03 to +8.51 |
| Full favored combination minus calm | +12.75 | +10.50 | +5.72 to +15.22 |
| Full adverse combination minus calm | -11.31 | -7.88 | -12.66 to -3.04 |

All four pooled point estimates moved toward neutral. The primary paired reduced-minus-original adverse effect was **+3.1875 points**, conservative 95% interval **-1.5672 to +7.9223**: 402 improved and 351 worsened winners. This does not establish a win-probability improvement at the prespecified level. The paired mean score-margin change was +1.839375 points (secondary approximate 95% interval +0.2587 to +3.4200). Secondary intervals are not simultaneous and cannot replace the primary result.

Reduced combined exploratory point estimates still exceeded the fifteen-point review level for Dover adverse (-17.00) and Hagerstown favored (+18.00), each based on only 200 fixtures and wide intervals. No universal ceiling is established.

## Independent shared-weather recheck

Philadelphia won 399/800 calm fixtures (49.875%) and 332/800 shared hot/wet fixtures (41.50%): **-8.375 points**, conservative 95% interval **-15.1460 to -1.4995**. Paired score-margin change was -2.58625 (secondary approximate interval -4.9469 to -0.2256).

This supports the prior shared-weather disadvantage (-11.75 points in the earlier 400-fixture Philadelphia profile). It does not independently confirm the previous full combined -19.75-point result. There were no thermal extremes or psychological modifiers in the 800-fixture recheck.

Norfolk's view of these same physical fixtures is exactly +8.375 points. It is a complementary view, not 800 additional independent samples or proof of engine order invariance. Simulation sides were balanced 400/400.

Descriptive diagnostics: Philadelphia shots per playing minute changed from 0.8472 to 0.8197; Norfolk from 0.8486 to 0.8376. Final squad energy changed from 0.8654 to 0.8414 and 0.8860 to 0.8640 respectively. These observations motivate weather-by-roster/strategy hypotheses but do not isolate heat, wind, rain or tactics causally.

## Decision and reliability

Retain 0.35 as a provisional lab candidate, with no default change or adoption. Next isolate weather components and strategy interactions in Philadelphia–Norfolk before further global tuning; keep psychology fixed. A larger fresh confirmation remains necessary before adoption. Cold response, normal trait distributions, halftime adaptation and seasons remain outside this screen.

Strict TypeScript, exact replay of 48 prior outcomes, mean-trait/calm neutrality, the 30% reduction in the model energy differential, role/side mapping, full save/resume of 164 preflight outcomes and corrupt telemetry rejection passed before execution. All 17,600 outcomes passed integrity checks; 82 first-fixture outcomes were fully replayed and nine controls checked against v1.0. All 64 protected files remained unchanged. A clean checkout plus the source patch reproduced the running lab hash. Independent CSV recomputation passed. Every preserved event archive was checked against its source bytes and all gzip streams/CRCs verified.
