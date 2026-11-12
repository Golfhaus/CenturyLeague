# Shared psychology: first implementation and studies

**The active tournament remains v1.0 and is unchanged. The new policy is default-off, experimental v2.0 code, not an adopted release.**

## Candidate and design

The explicit shared-psych-v1 policy reduces confidence to 35% of the earlier candidate, adds a 0.40% normal home execution-odds contribution, and caps the combined per-club execution-odds bonus at 0.90%. Home crowd support scales with form and becomes zero after five losses or at a neutral site. The cap changes action probabilities, never imposes a match winner. Frustration retains its existing discipline-aware severity pathway.

The plan and technical restart amendment were committed before replacement execution. The first screen was stopped on a duration-consistency failure after 22 saved fixtures; its evidence remains separate and is excluded from these estimates. Detached result snapshots, immediate and post-retention clock checks, and a 32-fixture regression address the observed artifact problem, while its underlying cause remains unresolved. No coefficients changed. Replacement screening used 128 matched seeds across nine conditions (1,152 results). Independent fresh confirmation used 2,048 seeds across three conditions (6,144 results), for 7,296 results in total. Both synthetic mirror-roster tactical profiles and simulation sides were balanced. All scheduled results were retained with fixed coefficients; the smaller screening sample was not pooled into the confirmation.

## Fresh confirmation

| Condition | Wins / 2,048 | Win rate | Change versus control |
| --- | ---: | ---: | ---: |
| No modifiers | 982 | 47.95% | +0.00 points |
| Reduced five-win confidence | 1,076 | 52.54% | +4.59 points |
| Maximum shared confidence/home support, opposing frustration | 1,080 | 52.73% | +4.79 points |

Primary maximum-stack effect: **+4.79 percentage points**, approximate paired 95% interval **+2.35 to +7.22 points**.

The conservative paired interval is **+1.16 to +8.38 points**, using Bonferroni-combined Wilson intervals for positive and negative discordance.

The point estimate exceeds the provisional four-point shared psychological review level. The uncertainty extends above that level, so this is not a certified ceiling.

The extra change made by the home/crowd/frustration stack over reduced confidence alone was +0.20 points (approximate paired 95% interval -1.28 to +1.67).

## Screening and verification

| Screening condition | Wins / 128 | Win rate |
| --- | ---: | ---: |
| control | 68 | 53.12% |
| confidence-3 | 69 | 53.91% |
| confidence-5 | 73 | 57.03% |
| home-ordinary | 70 | 54.69% |
| home-hot-5 | 70 | 54.69% |
| shared-hot-5 | 77 | 60.16% |
| shared-full-5 | 77 | 60.16% |
| home-losing-5 | 68 | 53.12% |
| shared-adverse-5 | 54 | 42.19% |

### Confirmation by tactical profile

| Profile | Matched seeds | Maximum-stack change | Conservative 95% interval |
| --- | ---: | ---: | ---: |
| neutral | 1,024 | +5.47 points | +0.36 to +10.53 |
| pressure | 1,024 | +4.10 points | -1.04 to +9.20 |

Context-specific uncertainty must be considered alongside the aggregate; this sample cannot certify a four-point ceiling in either tactical profile.

Screening estimates are descriptive and imprecise. The five-loss home-only condition matched the control sporting ledger exactly on every fixture. No special winner-rate adjustment was used to make it do so.

Policy tests verified 294 boundary contribution cases, venue/role validation, complete home neutralization, finite probabilities, symmetric opposed checks, no-feature and zero-cap equivalence, input immutability and full seeded replay. Every study result passed score/statistic reconciliation, final-event/root clock agreement and quarter playing-time reconciliation both on capture and after retention. All recorded contributions stayed within the shared cap; the maximum shared condition saturated the focal budget as specified. First fixtures per profile/condition were replayed and the controls checked against v1.0. Saved studies fully replay on resumption.

Legacy inputs without the new policy retain their original calculations. Original large-study evidence and coefficients were not overwritten. The 64-file v1.0 baseline lock passed before and after the studies. No stored player ratings or official availability/history were changed.

## Limits and next step

This candidate is flagged for revision: confidence alone has a +4.59-point estimate versus the proposed three-point peak review level, and the maximum shared stack has a +4.79-point estimate versus the four-point level. Their uncertainty intervals cross those review values; these estimates do not prove a true overshoot or establish a safe ceiling. Both tactical-profile maximum-stack point estimates exceed four points. Further checks need varied rosters and independent seeds. Weather, heat/cold tolerance and halftime adaptation remain planned; this is a psychological subgroup test, not a full perfect-storm result. The old telemetry field named confidence counts shared eligible execution checks in this policy, while psychology.contributions separately records confidence, home and cap saturation.

Review the actual paired uncertainty before claiming a match-level ceiling. Reduce both confidence and the shared ceiling before further integration. Lowering confidence alone would leave this saturated maximum-stack contribution at the same 0.90% action-odds cap. A proposed next candidate is confidence scale 0.20 and shared action-odds cap 0.60%, with home support held at 0.40% pending a larger isolated home comparison. Those values have not been applied or simulated and are not adopted settings. The unexplained original retention anomaly remains an adoption blocker pending diagnosis or runtime qualification; successful snapshot checks do not establish a root-cause fix. Passing mechanics checks does not automatically approve final coefficients or official adoption.

Source commit: `23e2c5a41a25e6a4bfed9aa06989b468fb735e21`. Source fingerprint: `2d487e1db4c7701042433beb8abf6c80ef95c9d6a58d2bea3c2efb6cbbf2e793`. Runtime: `{"arch": "x64", "node": "v24.22.1", "platform": "linux", "v8": "13.6.233.17-node.58"}`.

See the [prespecified plan](SHARED_PSYCHOLOGY_STUDY_PLAN_2026_11_12.md), [aggregate evidence](verification/shared-psychology-2026-11-12.json), and [compact research archive](verification/shared-psychology-2026-11-12.tar.gz).
