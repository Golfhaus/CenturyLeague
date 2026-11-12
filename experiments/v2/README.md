# Century engine laboratory — v2.0

The active inaugural tournament is **v1.0**. The separate candidate being developed here is **v2.0**. This directory is an experimental setup, not an adopted gameplay release.

## Release labels and historical compatibility

| Public label | Purpose | Preserved or new machine identity |
| --- | --- | --- |
| v1.0 | Frozen tournament baseline | `0.2.0-availability-candidate`; underlying gameplay/random namespace remains `0.1.0-exhibition` |
| v2.0 | Separate laboratory engine | `2.0.0-lab`; initially retains the same random namespace to enable a controlled baseline comparison |

The old identities appear in saved inputs, release hashes, seed construction and official result checks. Renaming them in the tournament would compromise historical compatibility. The labels above do not rewrite historical records or alter official defaults.

`baseline-lock.json` pins the original source commit and 64 existing files, including shared gameplay, availability, mirrored deployment code and verification scripts. The candidate engine is a physical fork in `src/engine.ts`, outside the source tree copied to official workers. It is not exported from simulation-core and has no official acceptance, database, scheduler or network imports.

This setup changes no tournament source, deployment, schedule, roster, player ability, result or official history. Adoption of v2.0 requires separate commissioner approval after the inaugural tournament concludes.

## Run the setup checks

Use Node 24, the runtime used to validate this setup. No dependency installation, credentials or database are needed:

```bash
node experiments/v2/validate.mjs
```

This compiles local TypeScript copies with Node's built-in transformer; it is runtime validation, not a replacement for TypeScript's semantic typecheck. Compilation output stays in `experiments/v2/build/`. The validator exercises synthetic fixtures, availability, scoring, replay, immutable inputs, baseline hashes, resumption, corrupt-ledger rejection and rejection of features not yet implemented.

The validator owns and recreates only `runs/setup-validation-reserved/`; do not use that reserved study ID for research. It tests hash enforcement by briefly changing a local baseline copy and restoring the exact bytes in a finally block. It never connects to the official system.

## Run a baseline comparison

```bash
node experiments/v2/run.mjs --study-id baseline-pilot-001 --trials 4
```

The default population contains three explicitly synthetic clubs; this makes 12 matched fixtures, 24 engine results and 24 full replay checks. These are setup checks, not estimates of modifier strength or real-club performance.

To use copied real rosters, supply a JSON array of canonical `MatchTeam` records (each has `id`, `name`, `coach: { name, tactics }`, and 35 `players: { id, name, ratings }`):

```bash
node experiments/v2/run.mjs --study-id roster-baseline-001 --trials 20 --date 2026-11-11 --teams /private/copied-teams.json
```

Input files are read-only. The harness deliberately pins healthy, suspension-free lab availability for each fixture; it does not retrieve or assume official availability. Use the engine API directly for prescribed availability scenarios. Every unordered pairing receives the requested even number of trials, split equally between simulation sides. There is no home advantage in this first baseline study.

The runner records an immutable manifest, full roster copy, fixture list, seeds, source/input hashes, complete results for both engines, result hashes and a final summary in `runs/STUDY-ID/`. Existing results must replay exactly; they are never discarded because of their outcome. An interrupted study resumes using the identical command. A changed source, roster, date or trial count requires a new study ID. Completed summaries are created only after every fixture passes.

Baseline comparisons normalize only two metadata fields: top-level `engineVersion` and `match_start.data.engineVersion`. Every input, availability record, sporting event, coordinate, score, timing and statistic must otherwise match exactly. Each engine's original version metadata is retained in its saved result and checked on replay.

Generated builds and results are ignored by git. Do not commit copied player data or full ledgers to the public repository. The runner's only output destination is its own `runs/` directory; it contains no official write pathway.

## Feature work and study order

`features.json` is the registry of proposals and measurement goals. Confidence and frustration are implemented for lab-only testing; all other gameplay modifications remain **planned**. Defaults enable nothing. `run.mjs` remains a baseline-equivalence runner and rejects any enabled features; `run-streaks.mjs` is the separately named feature experiment. Planned features such as weather fail explicitly rather than silently running a stub.

1. Establish no-feature v1.0/v2.0 equivalence.
2. Implement and test confidence and frustration independently, then home support, halftime adaptation, fixed weather and temperature tolerance.
3. Run paired single-feature pilots; expand the prespecified sample when precision warrants it. Retain all outcomes, effect sizes, intervals and relevant event denominators. Do not use a small setup sample as evidence of a 2–4 percentage-point effect.
4. Test interactions, particularly confidence/home support, frustration/pressure, and weather/fatigue/rotation.
5. Freeze settings and validate on fresh seeds, then conduct repeated isolated season rehearsals with copied histories.
6. Present keep/revise/defer/drop decisions before any official adoption.

Halftime is triggered by the leading score reaching 50, not elapsed minutes. Controlled deficits and first-half evidence should drive adaptation; proximity to victory is not an independent halftime input. Distance is always measured from the coach's original root strategy.

Weather tests use prescribed conditions first. A later live-data adapter must pin location, scheduled fixture time, provider, data validity time, units, quality/fallback status and selected conditions before simulation. Retries reuse the saved weather. Wind affects action difficulty for everyone; existing skill determines execution. Heat/cold tolerance remains a separate proposal, not a change to existing ratings.

All earlier numerical suggestions are calibration candidates, not approved coefficients. No test should target a preferred club, demand parity between unequal squads, reroll disappointing results or use official competition state as its experiment store.

## Confidence/frustration pilot (v2.0 only)

Confidence and frustration are now implemented as independent, default-off laboratory features. Use the streak-specific runner rather than the baseline-equivalence runner:

```bash
node experiments/v2/validate-streaks.mjs
node experiments/v2/run-streaks.mjs --study-id streak-pilot-001 --trials 64 --workers 4
```

The prespecified pilot has two synthetic mirror-roster profiles (neutral and higher-pressure tactics), 64 side-balanced trials per profile, and six arms: control; confidence at three and five wins; frustration at three and five losses; and three wins versus three losses with both features enabled. This yields 128 matched fixtures and 768 engine results. No real player records are changed. Identical mirrored ratings are controlled test inputs, not claims about real club strength.

Pre-match settings are saved in `input.lab`: signed consecutive-result streaks, enabled features and explicit coefficient scales. They never consult a mutable live table or update history during a match. Confidence multiplies odds by 1.005/1.01/1.015/1.02 at winning streaks of 2/3/4/5+, for ball-up and loose-ball contests, disposal accuracy and central shot outcomes. Opposed confidence cancels when both teams have the same streak. Catching, tackling, physical speed, fatigue and player ratings receive no extra confidence modifier.

Frustration changes only the existing serious-foul classification draw (baseline 9% conditional on a foul). The extra relative factor is 2% per loss beyond the first, capped at 8%, then multiplied by `(21 - Discipline) / 20`. Thus a Discipline-11 player on three losses has a 9.18% conditional severity chance, versus 9%; at five losses, 9.36%. Existing Discipline effects on ordinary foul occurrence remain unchanged. This is an aggregate foul-severity proxy, not a new retaliation/bench-misconduct taxonomy.

Telemetry records opportunities, outcomes, baseline/adjusted probability sums and same-draw threshold changes without consuming extra random draws. Contested ball/recovery probability is evaluated from simulation side 0's perspective, with the opposing side included in the odds ratio; those telemetry counters must not be mistaken for all contests involving only the focal club. Saved compact records distinguish contacts, actual foul opportunities and serious events, including the opponent in the combined arm.

The streak runner saves a manifest before simulation and gzip ledgers for every fixture/arm. It checks scoring/statistics for every result, fully replays the first declared fixture of each profile/arm, and checks those controls against v1.0. Resumption replays every saved result and never silently rerolls a corrupt ledger. Source/roster hashes must match the original manifest; changed code requires a new study ID. Worker threads are local computation, separate from tournament resources.

Reports include within-arm win intervals, paired winner differences, a conservative approximate paired interval from Bonferroni-combined Wilson discordance intervals, score margins, foul denominators and local threshold changes. The ordinary paired normal interval is secondary and can be misleading with zero discordance. A pilot of this size cannot reliably settle a 2–4 percentage-point match effect or a very small rare-foul increase; controlled probability sweeps verify the mechanics, and larger fresh-seed studies are required for calibration.

The earlier setup evidence is a historical checkpoint from before these features. Baseline defaults remain off and must still reproduce v1.0. Nothing in this pilot adopts v2.0 or changes official competition.

## Shared modifier envelope

[The combined modifier plan](../../docs/MODIFIER_ENVELOPE_AND_STRESS_TEST_PLAN.md) replaces isolated acceptance targets with a proposed shared budget and realistic favorable/adverse corners. `envelope-plan.json` is planning data, not engine configuration. `node experiments/v2/validate-envelope.mjs` validates 228 scenario cells and review-only diagnostics; `node experiments/v2/plan-envelope.mjs` reports implementation gates. Neither command simulates matches or changes coefficients. Full-stack effects remain unmeasured until the missing weather/trait/halftime mechanisms exist.

## Shared psychological candidate

The [November 12 shared-psychology plan](../../docs/SHARED_PSYCHOLOGY_STUDY_PLAN_2026_11_12.md) implements home support and reduced confidence under an explicit `shared-psych-v1` input policy. `--arms psychology` screens nine conditions; `--arms psychology-peak` confirms three selected-in-advance conditions. Legacy `--arms all` and `--arms confidence` preserve their original calculations. `node experiments/v2/validate-psychology.mjs` checks neutralization, saturation and replay. Home support is now lab-implemented; weather, temperature tolerance and halftime adaptation remain planned. The legacy telemetry field named `confidence` records the shared execution checks in the new policy; `psychology.contributions` distinguishes confidence, home support and cap saturation.

The [first shared psychological study](../../docs/SHARED_PSYCHOLOGY_RESULTS_2026_11_12.md) completed 7,296 prespecified results. Its candidate is flagged for revision: confidence alone added 4.59 percentage points and the maximum psychological stack 4.79 points relative to control in the fresh confirmation. Exact home neutralization passed. The report preserves the aborted initial run and the unresolved duration-retention anomaly, plus the strengthened snapshot/clock checks. This is not calibration acceptance or a full-stack result. Source-pinned historical studies must be replayed from their recorded source commit; later documentation updates change the lab fingerprint.
