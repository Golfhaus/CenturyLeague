# Fixed thermal reduction screen and independent matchup recheck

Pinned before execution. Lab only; v1.0, official histories and current tournament unchanged. No external publication.

## Candidate screen

Exactly 1,600 fresh matched fixtures: eight unchanged copied profiles × 200 independent seeds, half in each simulation-side position. Ten arms (16,000 outcomes): original calm control, shared hot/wet weather, favored/adverse thermal traits, favored/adverse full psychology combinations; plus four matching trait/combination arms using moderation 0.35 instead of 0.50. All other weather coefficients, traits, ratings, coaches and psychology remain unchanged. Original remains the default; reduced moderation requires an explicit lab input selector.

This is a paired candidate screen, not adoption or a ceiling certification. Lowering moderation by 30% reduces the additional energy-burden differential around mean tolerance by 30%; a proportional win-rate reduction is not assumed. Only hot/wet extremes are studied; cold performance cannot be inferred.

Study ID `thermal-reduction-screen-001`; 200 trials/profile; seed namespace `century-thermal-reduction:<studyId>:<profile>:<trial>`. No seeds from either earlier study reused or pooled. Match date 2026-11-13. Qualified Node runtime with Maglev disabled.

Primary: reduced adverse thermal arm minus original adverse thermal arm, paired focal win probability. Positive means reduced disadvantage. Secondary: each candidate's thermal effects versus identical shared weather; combined corners versus calm; paired changes in favored and combined arms; incremental psychology at fixed candidate/weather/traits; profiles, simulation sides, margins and energy. Primary nominal conservative 95% interval combines positive/negative discordance Wilson bounds with z=2.241403. Secondary intervals are per contrast, without simultaneous coverage. A non-significant difference is unresolved, not equivalence.

## Independent Philadelphia–Norfolk recheck

Exactly 800 fresh physical fixtures, Philadelphia focal versus Norfolk, side balanced 400/400, with calm control and shared hot/wet weather only (1,600 outcomes). Study ID `philadelphia-norfolk-weather-recheck-001`; distinct seed namespace. These fixtures are separate from the candidate screen.

Primary: Philadelphia shared-weather minus calm win probability. Norfolk's paired effect is calculated from the SAME outcomes as its exact complement; it is a reciprocal view, not 800 extra independent fixtures. This removes independent-sample fluctuation between separately run focal orientations. Report paired margin shift and side-specific results. Fresh candidate-screen club combinations are supplementary, distinct evidence.

## Fixed decisions and reliability

Complete all 2,400 unique matched fixtures / 17,600 outcomes. No coefficient tuning, adaptive sample expansion, seed replacement, outcome-dependent stopping or adoption. Technical failure stops a cohort with evidence retained. Approximate review levels remain 8 points physical, preferably 10 combined, review above 15; estimates and intervals both matter, and profile comparisons are exploratory.

Before the main runs: verify the optional selector changes only thermal moderation; omitted/default input reproduces prior full result hashes; neutral traits/calm weather remain unaffected; save/resume, corrupt telemetry rejection, role/side mapping, v1.0 lock and strict TypeScript pass. Fully replay the first fixture per profile/arm and compare first controls to v1.0; replay every saved result on resumption. Preserve all input/event ledgers and independently recompute effects from compact outcomes. Save reproducibility source and outputs durably.
