# Resolved result retention and second psychological candidate

**The v1.0 tournament engine remains unchanged. This is default-off, unadopted v2.0 research.**

## Result

The return-retention anomaly is addressed in the laboratory by an engine-owned snapshot boundary, complete post-retention checksums and a qualified optimizer configuration. The installed runtime fails the upstream numeric-isolation regression with Maglev enabled and passes it disabled. All 1,728 repaired retention results passed, with exact full-result agreement across the two runtime modes. The installed V8 binary itself was not patched globally; study workers must retain the qualification guard. See the [cause, fix and evidence](NUMERIC_RETENTION_RESOLUTION_2026_11_12.md).

The aggregate point estimates fall within the proposed individual/shared review levels. Confidence limits and contextual results must still be reviewed; these are not universal win-probability ceilings.

## Fixed study and coefficients

The plan and code were committed before calibration. Confidence scale is 0.20 instead of 0.35; the shared per-club action-odds cap is 0.60% instead of 0.90%. Home support stays at 0.40%, with peak crowd support 0.52%, five-loss neutralization and neutral-site behavior unchanged. Frustration is unchanged. The cap limits execution odds and never forces a match winner or clips observed win rates.

Screening used 128 matched seeds across nine conditions (1,152 results). Independent confirmation used 6,400 fresh matched seeds across four conditions (25,600 results). Both tactical profiles and simulation sides were balanced; all 26,752 scheduled outcomes were retained. Coefficients and sample sizes did not change during the studies. Screening was not pooled into confirmation.

## Fresh confirmation

| Condition | Wins / 6,400 | Win rate | Paired lift versus control | Conservative paired 95% interval |
| --- | ---: | ---: | ---: | ---: |
| No modifiers | 3,206 | 50.09% | — | — |
| Five-win confidence alone | 3,327 | 51.98% | +1.89 points | +0.22 to +3.56 |
| Peak crowd support alone | 3,311 | 51.73% | +1.64 points | -0.14 to +3.42 |
| Maximum confidence / home / opposing frustration | 3,328 | 52.00% | +1.91 points | +0.04 to +3.77 |

Maximum-stack approximate paired 95% interval: **+0.67 to +3.14 points**. The conservative intervals combine Wilson intervals for positive/negative discordance using Bonferroni protection. Neither interval is a guaranteed ceiling across all rosters or environments.

| Tactical profile | Maximum-stack lift | Conservative paired 95% interval |
| --- | ---: | ---: |
| neutral | +0.72 points | -1.90 to +3.34 |
| pressure | +3.09 points | +0.43 to +5.75 |

The previous independent confirmation estimated +4.59 points for confidence and +4.79 for the maximum stack. Those old estimates and the new ones use different seed samples; their difference is descriptive, not a paired old-versus-new experiment. The raw win rates must be compared to each study's own control. Peak crowd support alone disables confidence; it must not be added arithmetically to the confidence effect. The shared cap creates diminishing returns.

## Screening and checks

| Condition | Wins / 128 | Win rate |
| --- | ---: | ---: |
| control | 57 | 44.53% |
| confidence-3 | 65 | 50.78% |
| confidence-5 | 65 | 50.78% |
| home-ordinary | 65 | 50.78% |
| home-hot-5 | 69 | 53.91% |
| shared-hot-5 | 70 | 54.69% |
| shared-full-5 | 71 | 55.47% |
| home-losing-5 | 57 | 44.53% |
| shared-adverse-5 | 61 | 47.66% |

### Opponent serious-foul counts in confirmation

| Condition | Serious fouls / foul opportunities | Observed serious fraction |
| --- | ---: | ---: |
| No modifiers | 1,417 / 16,669 | 8.501% |
| Maximum confidence / home / opposing frustration | 1,492 / 16,608 | 8.984% |

These are conditional observed fractions, not isolated estimates of frustration: trajectories and incident composition can differ. The unchanged severity mechanism was checked separately.

The small screen also puts the adverse condition above control by 3.13 points; its conservative interval is -10.13 to +16.14 points. That is unresolved sampling variation, not evidence of an adverse-condition benefit. Calibration uses the separate fixed 6,400-seed confirmation.

Screening is descriptive. All 128 five-loss home-only outcomes matched the control sporting ledger exactly. Every result passed initial and retained full-hash/clock/statistic checks, stayed inside the action-odds cap and used inherited `--no-maglev` runtime flags. First fixtures per profile/condition were fully replayed; those controls were checked against frozen v1.0. Save/resume smoke tests fully replayed their saved results. The 64-file v1.0 source lock passed before and after research.

## Limits and remaining work

This is a synthetic mirror-roster study across two tactical profiles. Confidence intervals, profile variation, ordinary versus peak home support, varied club quality and accumulating season histories still matter. A within-budget point estimate is provisional calibration evidence rather than automatic acceptance. Weather, temperature tolerance and halftime changes remain unimplemented, and the full perfect-storm envelope has not been measured.

No coefficients were adopted, no player ratings or official history were changed, and no deployment or tournament operation was modified. Adoption remains a separate decision after the inaugural tournament and explicit commissioner approval.

Source commit: `109ba09069392e2ea031ee6edd1d88ea240289ea`. Source fingerprint: `dcd4858a5ff506c465bc48d7669cc023c1626abb72c8fd96ad51b04f6bde9832`. Runtime: `{"arch": "x64", "node": "v24.22.1", "numericIsolationProbe": "passed", "platform": "linux", "publicResultBoundary": "detached-json-snapshot-frozen-root-v1", "v8": "13.6.233.17-node.58", "workerExecArgv": ["--no-maglev"]}`.

See the [fixed plan](SHARED_PSYCHOLOGY_REDUCTION_PLAN_2026_11_12.md), [machine-readable evidence](verification/shared-psychology-reduction-2026-11-12.json), and [compact outcomes/recomputation archive](verification/shared-psychology-reduction-2026-11-12.tar.gz).
