# Fixed validation on copied founding squads

This study holds the reduced-020 candidate fixed: confidence scale 0.20, base home execution-odds bonus 0.004, shared per-club cap 0.006, unchanged frustration. It does not change the v1.0 tournament, official data or any player's ratings. No new features are implemented here.

## Inputs and selection, fixed before execution

Use the `teams.json` copy in `Century_Exhibition_Round_01_Data.zip`, dated October 31. Verify its archive SHA256SUMS and all 630 player-to-club memberships against `Century_Draft_State_After_Round_35.json`. Preserve original 35-player ratings, player identities and coach tactics exactly. These are copied founding squads, not a claim about current official availability; healthy, suspension-free laboratory availability resets each match.

Select four historically competitive pairings from the existing October 31 full-league balance report. Historical outcomes select the fixtures only and are never pooled with new validation outcomes:

| Pair | Historical first-club wins / 50 |
| --- | ---: |
| Dover Town CC – Lancaster Red Rose CC | 25 |
| Anacostia United – Hagerstown Albion | 25 |
| Norfolk Maritime – Philadelphia Northwest | 27 |
| Greensboro Crescent CC – Lynchburg Union | 22 |

Each pair appears in both focal orientations, giving eight profiles. Run **256 fresh independent seeds per profile**, half on each simulation side: **2,048 matched fixtures**. No club's ratings or coach settings are adjusted to make its fresh control rate more competitive. If the historical selection does not predict close modern controls, retain and report that limitation rather than replacing fixtures.

Each fixture has five conditions: control; five-win confidence alone; peak crowd support alone; favorable full psychology (focal five wins, home support, opponent five losses); adverse full psychology (focal five losses, opponent five wins and home support). Total: **10,240 engine outcomes**. All conditions reuse the same seed within a fixture. Home and streak assignments follow the focal club through simulation-side swaps.

## Analysis and stopping rule

Complete the entire fixed sample. No interim outcome review, coefficient tuning, condition removal, fixture replacement or result-dependent stopping. A technical failure stops the run and is recorded; an identical command resumes only after source and input agreement, replaying every saved result.

Primary comparison: favorable full psychology versus its own control. Secondary comparisons: confidence, peak crowd and adverse full psychology versus control. Report all raw wins, paired winner discordance, score-margin changes, per-club/per-pair controls, foul denominators and cap saturation. Per-contrast conservative Bonferroni/Wilson paired intervals are primary; ordinary approximate intervals are supplementary. They are not simultaneous protection across all profiles/conditions. Profile samples are for detecting contextual questions, not certifying a universal bound. Equal weights over eight selected profiles do not estimate a league-wide average.

The prior 6,400-seed synthetic confirmation remains separate, as does the recent 5,376-outcome synthetic screen. No post-hoc pooling. Comparing estimates across different samples and squad populations does not isolate a coefficient change. The action-odds cap is not a match win-probability ceiling.

Qualify Node with inherited `--no-maglev` and the numeric-isolation probe. Verify frozen v1.0 hashes and import boundaries, all scores/statistics/clocks, input immutability, post-retention full-result hashes and cap adherence. Fully replay the first fixture of each profile/arm; its control must match frozen v1.0. Validate save/resume, both side roles and corrupt-ledger rejection before the main run.

Commands (copied profiles remain outside public source):

```bash
node experiments/v2/validate-copied-profiles.mjs /private/real-club-validation-profiles.json
node experiments/v2/run-streaks.mjs --study-id real-club-psychology-validation-001 --trials 256 --workers 8 --date 2026-11-13 --arms psychology-validation --psychology-candidate reduced-020 --profiles /private/real-club-validation-profiles.json
```

Save the full manifest, complete ledgers, compact outcomes, reproducibility source and independent analysis. Weather, temperature tolerance, halftime adaptation, season histories and broader league-wide contexts remain later gates. No adoption follows automatically from this validation.

## Analysis metadata clarification before outcome inspection

The generic runner manifest inherits the legacy text label `primaryInterval` describing the ordinary approximate interval. The prespecified plan above and the runner’s stored conservative interval remain authoritative for this study’s primary reporting. Both intervals are calculated from the same complete outcomes; the conservative one will be reported as primary. This clarification changes no input, sample, coefficient, calculation or stopping rule. No new-study winner results were inspected before recording it.
