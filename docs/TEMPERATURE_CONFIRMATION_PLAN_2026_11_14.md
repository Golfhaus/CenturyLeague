# Fresh confirmation of the temperature/tolerance screening flags

Lab-only fixed study `temperature-tolerance-confirmation-001`. The three cases were selected from the completed 256-seed-per-matchup temperature screen, not chosen from any new outcomes. Keep the exact copied rosters, original tactics, fixed player-ID thermal traits, 80% humidity, no wind/rain, healthy availability, alternate-quarter end policy, disabled psychology, coefficients and date 2026-11-14. No official defaults, coaches, results, deployment, rulebook or protected v1.0 source change. The 0.35 setting remains provisional.

| Case | Focal/opponent | Candidate minus reference | Prior screening win change |
| --- | --- | --- | --- |
| dover-35-total | Dover / Lancaster | 35 C normal 0.35 minus 18 C mean tolerance | -8.203125 pp |
| norfolk-35-normal-traits | Norfolk / Philadelphia | 35 C normal 0.35 minus 35 C mean tolerance | +8.203125 pp |
| anacostia-28-moderation | Anacostia / Hagerstown | 28 C normal 0.35 minus identical normal traits at 0.50 | +10.15625 pp |

## Sample and primary inference

**4,096 new matched seeds per case**, balanced 2,048/2,048 across simulation sides. **12,288 independent fixture clusters / 24,576 outcomes**; only the two arms needed per case. New study-and-case-specific seed namespace; never pool the screen with confirmation, replace failed seeds, tune coefficients, stop on a favorable result or expand after looking. Fixture dispatch is round-robin across cases. Technical failures preserve the exact sample and stop; no automatic reroll or retry.

Primary family: three paired changes in focal win probability, candidate minus reference. Use conservative Bonferroni/Wilson discordance bounds across three contrasts / six marginal discordance probabilities: z = NormalDist.inv_cdf(1 - .05/12). For each case retain counts of candidate-only wins, reference-only wins and unchanged winners. At 4,096 seeds, the conservative interval under a zero-effect, maximum-discordance configuration has half-width about **4.119 percentage points**, versus about 5.820 at 2,048 seeds. This is a planning bound in a specified configuration, not guaranteed power or a promise of every realized interval width. This sample is 16 times the screen per case.

Secondary: within-arm win proportions and Wilson intervals; paired score-margin differences with approximate Bonferroni 95% family intervals across three cases, z = NormalDist.inv_cdf(1-.05/6); nominal per-side winner and margin checks; energy (both clubs), requested extra fatigue, duration, scoring and shot/execution denominators. Do not pool signed winner changes across arbitrary focal labels or treat two arms or reciprocal views as independent fixtures.

Report the three prior screen estimates alongside the fresh estimates, plus an exploratory independent-sample fresh-minus-screen difference interval. Selection makes this difference descriptive; it is not a preselected test of winner's curse. A failure to reproduce a selected extreme is not evidence that the original ledgers were wrong. Report all three cases, including inconvenient results and wide intervals.

The proposed eight-point shared-weather review level applies as a conditional diagnostic for Dover's weather-plus-normal-trait contrast, not a universal standalone trait or coefficient-change acceptance budget. If its full family interval lies within (-8,+8) pp, say only that this tested context is consistent with that review level at the stated method. Norfolk isolates this fixed population's normal-trait effect; Anacostia compares coefficient variants. Neither supplies a complete bound on absolute weather/trait or full-stack strength. Do not automatically adopt 0.35, declare equivalence, certify a global ceiling or retune to erase a screening flag.

## Integrity and delivery

Use the qualified no-Maglev runtime, default 15-second supervisor status and 300-second no-checkpoint-progress deadline. Before research validate case/role/side mapping, immutable traits/rosters, exact 18 C parity for all three profile copies, four historical result replays, full save/resume, corrupt telemetry rejection and the 64-file lock. During research fully replay the first two fixtures per case/arm (12 outcomes), check Dover's two neutral fixtures against v1.0, and audit every result's scoring/statistics/clocks/inputs/retained checksums. Preserve all atomic full gzip ledgers. Afterward verify every ledger CRC/hash and compact record and independently recompute declared effects and intervals. Keep computation, audit, analysis and delivery states separate. Deliver a compact report/data/source bundle first; bulk ledgers remain a separate handoff.
