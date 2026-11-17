# Fixed weather and independent thermal traits: first candidate and screen

This is isolated, default-off v2.0 research. The reduced psychological settings remain confidence scale 0.20, home odds bonus 0.004, shared per-club cap 0.006 and unchanged frustration. No v1.0 source, official ratings, histories, deployment or rulebook is changed.

## Mechanisms fixed before the screen

The versioned `fixed-weather-v1` input pins a single shared environment, explicit end policy and optional per-player heat/cold traits. The closed input envelope is temperature -5 to 40 C, humidity 0–100%, sustained wind 0–45 km/h, gusts between sustained wind and 65 km/h, rain 0–10 mm/h and direction 0–359.999 degrees. These are accepted laboratory inputs, not certified playable-weather limits.

All coefficients below are hypotheses chosen for a bounded first candidate, not values measured for Century:

- Wetness = min(1, rain / 5); wind burden = min(1, sustained wind / 35); gust burden = min(1, (gust - wind) / 30).
- Kick-disposal log-odds penalty = 0.06 wetness + 0.05 wind + 0.03 gust. Hand-disposal penalty = 0.035 wetness. Catch penalty = 0.08 wetness + 0.035 wind + 0.02 gust. Central-shot penalty = 0.06 wetness + 0.05 absolute crosswind burden + 0.03 gust. Apply these to the existing skill/energy-derived odds; no additional match RNG draws.
- Kick range multiplier = 1 + 0.035 tailwind/35 - 0.015 wetness, bounded to [0.94,1.06]. Kick-pass lateral drift = 0.025 metres per km/h of signed crosswind. Wet support/carry movement is multiplied by 0.985 at full wetness. Administrative restarts and bounce-classification physics are not modeled as a full aerodynamic system.
- Heat burden = clamp((temperature - 24)/12,0,1) times (0.7 + 0.3 humidity fraction). Cold burden = clamp((10 - temperature)/15,0,1) times min(1.4, 1 + 0.25 wetness + 0.15 wind). The two thermal burdens cannot be active simultaneously.
- Fatigue multiplier = 1 + 0.12 heat burden times heat moderation + 0.06 cold burden times cold moderation. Recovery multiplier = 1 - 0.04 heat burden times heat moderation - 0.02 cold burden times cold moderation.
- A corresponding trait t in [0,1] sets moderation to 1 - 0.5(t - 0.5). High tolerance reduces only the relevant additional weather burden, not baseline fatigue, and grants no permanent rating bonus. Typical heat/cold values come from separate independent normal draws, mean 0.5 / SD 0.15 clipped to [0.1,0.9], in a player-ID-seeded namespace separate from match RNG. Extreme cohorts use 1 versus 0 only for the relevant trait. No player record is edited.
- Neutral/calm conditions have exact identity effects, including when traits are enabled. Psychology is applied after physical execution difficulty, with its earlier cap unchanged. Heat does not directly penalize every pass; its effect is mediated through energy and existing rotation/skill mechanics.

Wind is a signed physical vector. The legacy engine retains a fixed attack-coordinate frame, so the weather input explicitly pins either `alternate-quarters` or `fixed` ends. Alternating quarters is a laboratory assumption, not adoption of a previously established end-change rule. Include a fixed-end sensitivity arm; do not silently give a club a permanent tailwind. Neither end policy establishes an official rule or a universal wind worst case.

The broad directions are informed by [Mohr et al., football in the heat](https://pmc.ncbi.nlm.nih.gov/articles/PMC3378691/) and [NASA's ball-force explanation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/forces-on-a-soccer-ball/). The former reports complex responses, including lower high-intensity running without uniformly worse technical execution. Neither source supplies the Century coefficients above. The weather module is an event-level approximation, not CFD or a physiological safety model.

## Fixed copied-squad screen

Use the exact eight copied founding profiles from the completed real-club psychology validation: Dover/Lancaster, Anacostia/Hagerstown, Norfolk/Philadelphia and Greensboro/Lynchburg, each in both focal orientations. Keep every rating and original tactic unchanged. Reset healthy lab availability each fixture. Their historical selection remains fixed; do not replace profiles in response to new outcomes.

Study ID: `fixed-weather-thermal-screen-001`. **64 fresh seeds per profile**, half on each simulation side, gives **512 matched fixtures**. Execute all **19 arms** from `weather-fixtures.mjs`: **9,728 outcomes**. They include control; exact calm parity; shared wind/rain under both explicit end policies; shared hot/cold; normal thermal traits in hot/cold; hot-wet shared; favorable/adverse extreme traits in hot, hot-wet and cold; and favorable/adverse combinations with unchanged psychology in hot-wet and cold.

Prescribed inputs:

| Environment | Temperature C | Humidity % | Wind / gust km/h | Rain mm/h |
| --- | ---: | ---: | ---: | ---: |
| Calm control | 18 | 55 | 0 / 0 | 0 |
| Wind/wet | 17 | 85 | 35 / 50 | 5 |
| Cold wind/wet | 4 | 90 | 35 / 50 | 5 |
| Hot/humid | 35 | 80 | 0 / 0 | 0 |
| Hot wind/wet | 35 | 80 | 35 / 50 | 5 |

Wind direction is pinned at 45 degrees. These are initial corners, not an exhaustive search over direction, temporal gusts, pitches, rosters or weather conditions. No live weather provider is called.

## Analysis and reliability

Primary contrast: **hot favorable thermal extremes minus hot shared mean-tolerance weather**, using the same fixtures. Secondary: analogous cold and hot-wet contrasts; reversed trait extremes; normal traits; shared-weather versus calm changes; adding psychology to identical environment/traits; combined corners versus calm; and fixed-end sensitivity. Compare trait cases to their same-weather reference so a weather effect is not mislabeled as tolerance. Report per-club controls and both simulation sides.

Use paired winner differences and conservative Bonferroni/Wilson discordance intervals; ordinary approximate intervals supplementary. Intervals are per contrast, not simultaneous across every arm/profile. This is a first screen, not universal ceiling certification. Keep it separate from all previous studies. No coefficient changes, arm removal, fixture replacement or outcome-dependent stopping. All 9,728 outcomes must be retained. A technical failure stops and is documented rather than rerolled.

Record scores, duration, shots, final energy, time-weighted active energy, energy-floor exposure, requested extra fatigue and local physical-probability counters with denominators. Requested extra fatigue is a model budget before the energy floor, not an observed physiological quantity. Absolute accuracy averages can change because the sampled actions and players change; pure mechanics tests establish the intended same-check direction.

Prerequisites: strict TypeScript check, disabled/calm exact parity, independent traits, wind/end symmetry, invalid-input rejection, full enabled replay and retained checksums, exact replay of 40 old psychology results, save/resume and corrupted weather-telemetry rejection, and unchanged 64-file v1.0 lock. Workers retain the qualified `--no-maglev` runtime. Preserve manifests, profiles, source patch, all full ledgers and independent recomputation.

```bash
node experiments/v2/validate-weather.mjs experiments/v2/runs/real-club-psychology-validation-001
node experiments/v2/validate-weather-study.mjs /private/real-club-validation-profiles.json
node experiments/v2/run-streaks.mjs --study-id fixed-weather-thermal-screen-001 --trials 64 --workers 8 --date 2026-11-13 --arms psychology-weather --psychology-candidate reduced-020 --profiles /private/real-club-validation-profiles.json
```

Review the full screen before selecting extremes for a separate fixed fresh-seed confirmation. No adoption, empirical weather calibration, full perfect-storm claim, halftime adaptation or accumulating season rehearsal follows automatically.
