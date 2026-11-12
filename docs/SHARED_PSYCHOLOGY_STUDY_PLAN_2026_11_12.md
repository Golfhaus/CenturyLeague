# Shared psychological adjustment: implementation and fixed study plan

This implements the next laboratory step from the shared modifier budget. It is not an adopted gameplay release. v1.0 and all official execution paths remain unchanged; v2.0 still enables no modifiers by default.

## Candidate policy

The explicit `shared-psych-v1` input policy uses confidence at 0.35 of the previous experimental coefficient: execution-odds bonuses are 0.175%, 0.35%, 0.525% and 0.70% for 2/3/4/5+ consecutive wins. Legacy inputs without this policy retain their existing calculations and coefficients.

Normal home support contributes a 0.40% execution-odds bonus. Crowd enthusiasm is 1.0 after no streak or one result, 1.075/1.15/1.225/1.30 after 2/3/4/5+ wins, and 0.75/0.50/0.25/0 after 2/3/4/5+ losses. Thus peak home-only support contributes 0.52%; a neutral site or five-loss home streak contributes zero. The visitor receives no home contribution.

Confidence and home support combine multiplicatively at the same eligible execution check, then their combined odds bonus is capped at 0.90% per club. At maximum confidence plus crowd support, the uncapped bonus would be 1.22364%, so the shared limit provides diminishing returns. Opposed checks compare the two clubs' bounded contributions. Shot execution uses the acting club's contribution. No extra motivation bonus is applied elsewhere, and no match winner or win probability is forced or clipped.

Frustration remains in the separate existing Discipline-aware serious-foul pathway, using the previous scale of 1. Its consequences are included in the combined match comparisons. Player ratings, fatigue equations and coach tactics are unchanged.

All of these are proposed experimental coefficients. A bound on per-action odds is not proof of a particular match-level effect; simulations must measure the latter.

## Prespecified studies

1. **Screening:** 128 matched fixture seeds, 64 per neutral/pressure synthetic mirror-roster profile, equal simulation-side exposure. Nine conditions produce 1,152 engine results: control, reduced three-/five-win confidence, ordinary home support, hot home support, shared hot confidence/home support, full shared support plus opposing frustration, home support neutralized by five losses, and the adverse reverse stack.
2. **Fresh confirmation:** 2,048 matched seeds, 1,024 per profile, with control, reduced five-win confidence and the maximum combined psychological stack. Three conditions produce 6,144 results. The conditions and coefficients are fixed before screening and are not selected or retuned according to its outcomes.

The primary confirmation comparison is maximum shared psychology minus control on the same fixtures. Reduced confidence minus control and the difference made by home support are secondary. Report paired uncertainty, raw wins, scoring margins, cap saturation and foul denominators. This is not powered to certify that the true maximum is below the proposed four-point review threshold; keep the confidence limits visible.

Complete every scheduled condition, retain every outcome and use fresh study IDs/seeds. Never tune toward a particular club, discard disappointing results or reuse the screening sample as fresh confirmation. These are synthetic controls, not real-club forecasts or official results.

## Verification

- Exhaustive boundary checks for the crowd curve, shared ceiling, role symmetry, finite probabilities and input validation.
- Exact zero-effect equivalence for neutral sites, disabled features, a zero cap and five-loss home support.
- Full seeded replay and input immutability, plus the 64-file frozen v1.0 source lock.
- Scoring/statistic reconciliation for every study result; first fixture per profile/condition replayed, first controls checked against v1.0.
- Exact control equivalence for the five-loss home-only condition on every screening fixture.
- All saved results fully replay on resumption. Preserve manifests, runtime, full-result checksums and compact research outcomes.

```bash
node experiments/v2/validate-psychology.mjs
node experiments/v2/run-streaks.mjs --study-id shared-psych-screen-002 --arms psychology --trials 64 --workers 8 --date 2026-11-12
node experiments/v2/run-streaks.mjs --study-id shared-psych-confirm-002 --arms psychology-peak --trials 1024 --workers 8 --date 2026-11-12
```

Weather, heat/cold tolerance and halftime adaptation remain unimplemented. These studies address the psychological subgroup only, not the full perfect-storm envelope. No v2.0 adoption or production deployment is authorized by passing these checks.

## Technical amendment before replacement studies

The initial `shared-psych-screen-001` was stopped after 22 saved fixtures when fixture `neutral-22` failed exact home-neutralization comparison. Only root duration summaries differed; scores, events, quarters and statistics agreed, and the control root clocks contradicted its own final event. `shared-psych-confirm-001` never started. The [abort evidence](verification/shared-psych-screen-001-abort.json) and [full captured mismatch](verification/shared-psych-screen-001-mismatch.json.gz) preserve that diagnostic sample; it is excluded from calibration.

Diagnostic instrumentation affected reproducibility, so the underlying cause remains unresolved. The laboratory now captures detached result snapshots with frozen roots immediately and checks clock consistency on return and again after retaining all conditions. A regression retains the original first 32 fixture inputs across all nine conditions. Replacement studies use IDs `002`, the same sample sizes, conditions, coefficients and stopping rule, and fresh seeds. This is a technical restart, not a coefficient or outcome-based change. These checks must pass before any research estimates are used.

## Completed replacement studies

Both replacement studies completed all 7,296 prespecified results with fixed coefficients. See [results and remaining gates](SHARED_PSYCHOLOGY_RESULTS_2026_11_12.md). The candidate is flagged for revision rather than calibration acceptance; the next lower settings discussed there have not been applied or tested.
