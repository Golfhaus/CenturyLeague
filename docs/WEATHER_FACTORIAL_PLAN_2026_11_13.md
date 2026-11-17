# Philadelphia–Norfolk weather and workload factorial

Pinned before execution, 2026-11-13. Lab only. No engine coefficient, default, v1.0, official history or tournament changes. The optional 0.35 thermal candidate remains provisional; tolerance extremes and psychology are disabled here.

## Fixed design

Exactly **800 fresh matched fixture seeds**, Philadelphia focal versus Norfolk, balanced across simulation sides (400/400). Every seed runs **16 arms / 12,800 outcomes**: all eight heat × wind × rain combinations in each of two tactical contexts. Same original copied rosters, ratings, coaches and healthy availability; no accumulating histories or halftime adaptation.

- Heat off/on: 18 / 35 C. Relative humidity stays 80% in every cell; the 18 C neutral cell has no thermal load.
- Wind off/on: 0/0 or 35/50 km/h sustained/gusts; direction stays 45 degrees. Wind and gusts form one component.
- Rain off/on: 0 or 5 mm/hour.
- Explicit lab end policy remains alternate quarters; no official end rule adopted.
- Original tactics versus matched pace/workload: only Philadelphia tempo 5→4, running emphasis 5→4 and pressure 3→2 change, matching Norfolk's existing values. All other tactical fields and all ratings remain unchanged. This is a joint three-setting intervention, not neutralization of all tactics or proof of equal actual energy use.
- No temperature-tolerance traits or psychological features enabled. Existing psychology coefficients remain fixed but inactive. Weather coefficients are unchanged laboratory hypotheses.

Study ID `philadelphia-norfolk-weather-factorial-001`; namespace `century-weather-factorial:<studyId>:<trial>`. Match date 2026-11-13. Qualified Node runtime with Maglev disabled. No previous seeds reused or pooled.

## Prespecified analysis

**Primary:** interaction between the workload-setting intervention and full weather in mean score margin:

`[matched(full) − matched(neutral)] − [original(full) − original(neutral)]`.

Positive means the intervention weakens Philadelphia's weather disadvantage. Compute each contrast within a fixture, then a paired mean ±1.96 sample standard error across the 800 independent fixture clusters. This is a large-sample nominal 95% interval, not exact finite-sample coverage. Win-rate interaction is secondary, with the same fixture-cluster method and percentage-point units.

Secondary diagnostics: direct full-weather-minus-neutral effects under each context (conservative paired Wilson intervals for win probability; approximate paired intervals for margins); all weather cells; simulation sides; heat/wind/rain Shapley allocations of the full-weather change, factorial main effects, pair interactions averaged over the third component, and the three-way interaction. All are computed within fixtures before estimating uncertainty. Do not treat 16 arms, multiple components or reciprocal club views as independent samples.

For each component, the Shapley allocation averages its six possible orders of introduction: weight 1/3 when introduced first, 1/6 after either one other component, and 1/3 after both. Allocations sum exactly to full weather minus neutral; differences between contexts sum to the primary interaction. This is a declared allocation of interactions, not a uniquely correct physical attribution. Report signed points/margins, not misleading percentages when totals approach zero. Secondary intervals are nominal per contrast, without simultaneous protection; do not add interval endpoints.

Energy, local execution probabilities, shots and playing duration are descriptive mechanism diagnostics. A supported intervention effect identifies this three-setting package within this model, not one tactic or an empirically calibrated real-world mechanism. A non-significant interaction remains unresolved, not evidence of no tactical role.

## Execution and preservation

Complete all cells/seeds; no tuning, seed replacement, outcome-based stopping, pooling or sample expansion. Technical failure stops the run with evidence retained. Freeze source throughout. Before execution: exact legacy input/result replay, calm parity against v1.0 in both contexts, condition construction, rating/coach immutability, side mapping, full save/resume and corrupt telemetry rejection. Replay the first two fixtures per arm; every saved result replays on resume. Audit all outcomes, retain full ledgers, verify source and all 64 protected v1.0 files, independently recompute contrasts from compact data, and save reproducibility inputs and checked archives.
