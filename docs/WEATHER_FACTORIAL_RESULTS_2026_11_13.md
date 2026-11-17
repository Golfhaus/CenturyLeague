# Philadelphia–Norfolk weather factorial results

Completed 2026-11-13, lab only. Fixed plan: `WEATHER_FACTORIAL_PLAN_2026_11_13.md`. All **800 fresh matched fixture clusters / 12,800 outcomes** completed. No earlier seeds reused or pooled. Source SHA-256: `9f39082d0d6ade8e0c811a4237c4e8a55200f9e1fb20673b124b8badb1715ff4`.

All eight heat × wind/gust × rain combinations were run under original tactics and a matched pace/workload context. The latter changes only Philadelphia tempo 5→4, running emphasis 5→4 and pressure 3→2, matching Norfolk. No other tactics or player ratings changed. Humidity stayed 80%; component levels and quarter-end policy were pinned. Psychology and tolerance traits were disabled; the 0.35 candidate remained provisional and inactive.

## Primary result

The matched-minus-original interaction in the full-weather score-margin penalty was **+2.00 score points**, nominal approximate paired 95% interval **-1.208 to +5.208**. The three-setting package's weather-specific mitigation remains unresolved. This is not proof of no tactical role, and it does not identify one setting.

The secondary win-rate interaction was +1.375 percentage points (-5.352 to +8.102). The raw matched-context gain was already +6.125 points in neutral weather versus +7.50 in full weather; it cannot all be attributed to weather protection.

## Component allocation under original tactics

The following signed Shapley allocations average the six orders of introducing components, including allocated interactions. They sum to the full-weather change; they are not uniquely correct physical attribution. Intervals are nominal per contrast, not simultaneous.

| Component | Mean score-margin allocation | Approximate 95% interval | Win-rate allocation, points | Approximate 95% interval |
| --- | ---: | --- | ---: | --- |
| Heat | -1.8571 | -3.0383 to -0.6758 | -2.7708 | -5.1829 to -0.3588 |
| Wind + gusts | +0.1923 | -1.0229 to +1.4075 | +1.4792 | -0.9936 to +3.9520 |
| Rain | -1.0840 | -2.2893 to +0.1214 | -1.8333 | -4.4611 to +0.7945 |

Heat is the clearest adverse diagnostic signal. Wind and rain allocations remain unresolved; the positive wind estimate does not prove a protective effect. Pair and triple weather-interaction intervals also crossed zero.

Matched-setting score-margin allocations were heat -1.1223 (-2.3332 to +0.0886), wind +0.1821 (-0.9942 to +1.3584), and rain +0.1915 (-0.9598 to +1.3427). None of the component allocation changes between contexts excluded zero.

## Comparison with prior recheck

Under original tactics, full weather minus neutral gave **-3.125 win-rate points** (conservative paired 95% -9.861 to +3.650), versus -8.375 (-15.146 to -1.500) in the independent prior recheck. These intervals overlap. Mean score-margin effects are similar: **-2.74875** (-5.0294 to -0.4681) here versus **-2.58625** (-4.9469 to -0.2256) previously. The performance penalty remains evident in margins, while the latest winner-rate estimate is smaller and imprecise. Do not treat the old -8.375 as a known constant.

Under matched settings, the weather margin penalty was -0.74875 (-2.9512 to +1.4537) and the win-rate change -1.75 (-8.4686 to +4.9905). One context excluding zero while another does not is not proof of a difference; use the primary interaction above.

## Decision and reliability

Keep weather coefficients and official coaches unchanged. Retain 0.35 as a provisional option. Broader real-club heat validation is preferable to further global tuning based on one matchup. No coding defect or universal effect ceiling was established. These are conditional model mechanisms, not empirical physiology or cold-response validation.

Before execution, 32 input constructions, four exact legacy-result replays, calm parity in both contexts/sides, immutable ratings/rosters, only declared tactical changes, full save/resume of 32 outcomes and corrupt telemetry rejection passed. All outcomes passed score/statistics/clock/input/retained-result checks; 32 main outcomes were fully replayed and four neutral controls checked against v1.0. All 64 protected v1.0 files and the final lab lock passed. A clean checkout plus source patch reproduced the running hash.

Independent CSV recomputation checked all paired contrasts, six-permutation Shapley allocations and sum identities, factorial and side contrasts, and cell metrics. Full event archives were checked against source bytes and every gzip stream/CRC verified. No official history, tournament, default or external-publication writes occurred.
