# Cold response and tolerance validation

Lab-only fixed study `copied-club-cold-validation-001`; no coefficient, official rating, coach, result, deployment or v1.0 changes. Retain 0.35 as a provisional thermal-tolerance option, with 0.50 unchanged as the legacy default. The completed heat confirmation is not rerun or pooled.

## Recovery and fixed sample

The scratch working directory was reset before this step. Restore the last saved source patch onto public base `1f867ad5de47a6e8c40b70cbcb379e8751c72e8a`. Its laboratory source fingerprint must equal `04196643f295b7985ecb989a7a88821ac636b3a6dbd824870baaf55dd58a667f` before adding this new study. All 64 baseline files must match. The compact confirmation outcomes and complete reproduction inputs survived in the saved bundle. Prior unsaved full ledgers are unavailable after the reset; this does not require repeating completed scientific studies. Qualify restoration by regenerating four declared historical outcomes and comparing their retained full-result SHA-256 values.

Use the same four canonical copied pairings (Dover–Lancaster, Anacostia–Hagerstown, Norfolk–Philadelphia, Greensboro–Lynchburg), **512 new matched seeds per pairing**, 256/256 across simulation sides: **2,048 fixture clusters × 12 arms = 24,576 outcomes**. Fixed study-specific seed namespace, original rosters/tactics, healthy lab availability, date 2026-11-14, quarter-alternating ends, disabled psychology. Do not pool the old 64-seed-per-profile screen, replace failed fixtures, tune coefficients or stop/expand based on outcomes.

## Environments and arms

All humidity 90%; dry conditions have no wind/rain/gusts; wet conditions use 35/50 km/h wind/gusts, 5 mm/h rain and direction 45 degrees.

| Arms | Temperature | Tolerance |
| --- | --- | --- |
| dry18 / dry0 / dry-5 | 18 / 0 / -5 C | mean (traits off) |
| wet18 / wet4 / wet-5 | 18 / 4 / -5 C | mean (traits off) |
| dry-5-normal-035 / wet-5-normal-035 | -5 C dry / wet | fixed normal traits, 0.35 |
| wet-5-favored-035 / wet-5-adverse-035 | -5 C wet | focal cold tolerance 1 versus opponent 0, or reverse; 0.35 |
| wet-5-favored-050 / wet-5-adverse-050 | -5 C wet | identical opposed extremes, 0.50 |

Normal traits reuse the existing player-ID seeded independent heat/cold method, mean .5 / SD .15 clipped [.1,.9], fixed across arms and fixtures. Heat load is zero throughout. In extreme arms heat traits are .5 and cold traits 1/0. No existing player attribute is edited. Shared weather affects both squads; thermal traits moderate only extra cold fatigue/recovery.

The model cold load is clamp((10-T)/15,0,1) × min(1.4,1 + .25 wetness + .15 wind burden). Mean cold fatigue/recovery coefficients remain .06/.02. At 4 C wet the load is .56; at -5 C wet it is 1.4. This new severe condition is not a replication of the earlier 4 C cold-trait winner estimates (+6.25/-6.05 pp with broad intervals). The direct 0.35/0.50 contrasts use identical new fixtures and weather.

## Analysis fixed before execution

Primary: pooled paired focal winner change **wet-5-adverse-035 minus wet-5**, using all 2,048 fixture clusters; the intervention always disadvantages the focal club, so the direction is consistently defined across pairings. Conservative paired Bonferroni/Wilson discordance interval, z = NormalDist.inv_cdf(1-.05/4). Primary precision is not a guarantee of a global eight-point ceiling. Report each pairing and both sides as well.

Secondary per-contrast nominal intervals: favored 0.35 minus shared; both extremes 0.50 minus shared; reduced-minus-original for each extreme; normal traits minus the same dry/wet severe mean-tolerance reference; wet4 minus wet18 and wet-5 minus wet18; dry0/dry-5 minus dry18. Weather-only winner effects are reported per pairing, not pooled across arbitrary focal labels. Score margins, physical active/final energy, requested fatigue, duration, scoring and shot/kick denominators are retained for every arm. Report the four matchup-specific primary intervals with Bonferroni family protection (four comparisons); all remaining subgroup/side intervals are exploratory nominal.

Physical cold increments compare equal-club-weight fixture active energy with their same dry/wet temperate reference. Compare the wet-minus-dry cold increment at -5 C as a paired interaction, with a nominal interval. Wind/rain execution penalties remain present in wet arms and must not be attributed to cold. Validate their held-state independence from temperature; observed action/accuracy averages can change as energy, players and actions change.

No automatic coefficient adoption, trait-specific acceptance budget, full-stack/halftime claim or empirical physiology follows from this study. All tested extremes remain conditional on fixed copied clubs, one normal trait population, weather levels and availability. A selected screening flag requires a new fixed confirmation; do not reuse this screen as its own confirmation.

## Qualification and retention

Before launch: all arm/side mappings, held-state onset/saturation and wet amplification, inactive heat, independence of normal heat/cold draws, neutral normal-trait parity in dry and wet settings, exact v1.0 dry parity, four historical full-result hash replays, immutable profiles, save/resume and corrupt-telemetry rejection. Qualified no-Maglev workers, 15-second status and 300-second no-checkpoint-progress deadline. Fully replay first two fixtures per profile/arm (96 outcomes) and check eight dry controls against v1.0. Every saved result passes clock/statistics/scoring/input/retained checksum checks. Audit all gzip CRCs and hashes after completion, independently recompute declared contrasts, preserve exact seeds and source, and deliver the compact bundle first. No bulk archive is required for review.
