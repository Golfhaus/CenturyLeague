# Fixed hot/wet thermal confirmation — 2026-11-13

Lab only. Frozen before the first confirmation fixture. No official tournament, source v1.0, roster, coach, result, or history writes.

## Question and fixed design

Confirm whether the screened adverse temperature-tolerance mismatch materially changes focal win probability in the same hot/wet physical environment. The 512-fixture screen is discovery evidence, excluded from the confirmation estimate.

- Study ID: `hot-wet-thermal-confirmation-001`.
- Exactly 3,200 independent matched fixture seeds: 400 for each of the eight unchanged copied founding-club profiles. Each profile has 200 fixtures in each simulation-side position.
- Six arms on every fixture (19,200 retained outcomes): control; hot-wet-shared; hot-wet-traits-favored; hot-wet-traits-adverse; hot-psych-favored; hot-psych-adverse. Arm definitions are copied unchanged from the screen.
- Fresh seed namespace `century-streak-study:hot-wet-thermal-confirmation-001:<profile>:<trial>`; match date 2026-11-13; qualified Node runtime with Maglev disabled.
- Conditions: 35 C, 80% relative humidity, 35 km/h wind, 50 km/h gusts, 5 mm/h rain, 45-degree direction. Alternate-quarter ends remain an explicit lab assumption.
- Weather coefficients unchanged, including trait moderation 0.5. Extreme relevant heat traits are 1 versus 0 (favored), or 0 versus 1 (adverse); cold traits remain 0.5. Shared-weather traits are neutral 0.5.
- Psychology unchanged: confidence scale 0.20, home base odds bonus 0.004, shared action odds cap 0.006, frustration scale 1. Combined arms use the same five-win/five-loss and home roles as the screen.

## Analysis fixed in advance

Primary: **hot-wet-traits-adverse minus hot-wet-shared**, paired focal win probability. Report discordant counts and conservative 95% interval: Wilson bounds for positive/negative discordance at z=2.241403, combined with Bonferroni subtraction. The ordinary paired-normal interval is supplementary. Intervals are per contrast; exploratory profile comparisons do not carry a familywise guarantee.

Secondary: favored traits versus shared weather; both complete corners versus calm control; incremental psychology at identical weather/traits; shared hot/wet versus calm; paired margins, final energy, playing duration, per-club and simulation-side results. Keep screening and fresh-confirmation estimates separate. Club selection and extreme all-squad traits limit generalization.

3,200 seeds were fixed using the prior discordance estimate; conservative interval half-width is expected to be about 3.4 percentage points, without a precision guarantee. Review levels remain approximately 8 points for an extreme physical mismatch, preferably 10 combined, with combined estimates above 15 requiring review. These are design review levels, not engine clamps or established real-world limits. A confidence interval crossing a review level leaves its magnitude unresolved.

Complete every prespecified fixture and arm. No coefficient changes, seed replacement, outcome-dependent stopping, pooling, or sample expansion. A technical failure stops execution and retains evidence. Full replay of the first fixture for every profile/arm; all saved results replay on resume. Before starting, verify screened result hashes on those same six arms, frozen v1.0 checks, save/resume, role mapping, and corruption rejection. Independently recompute contrasts from compact outcomes and retain full ledgers with checksums.

The result informs whether a subsequent fixed study should reduce thermal-trait moderation. It does not authorize adoption of coefficients or changes to the live competition.
