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

`features.json` is the registry of proposals and measurement goals. All gameplay modifications are **planned**, with none enabled or silently stubbed. `--features confidence` (or any other planned feature) fails explicitly. The current comparison runner supports baseline equivalence only; before enabling a feature, implement its isolated scenarios, parameters, telemetry and effect-comparison report, and stop requiring baseline equality for that explicitly named experiment.

1. Establish no-feature v1.0/v2.0 equivalence.
2. Implement and test confidence and frustration independently, then home support, halftime adaptation, fixed weather and temperature tolerance.
3. Run paired single-feature pilots; expand the prespecified sample when precision warrants it. Retain all outcomes, effect sizes, intervals and relevant event denominators. Do not use a small setup sample as evidence of a 2–4 percentage-point effect.
4. Test interactions, particularly confidence/home support, frustration/pressure, and weather/fatigue/rotation.
5. Freeze settings and validate on fresh seeds, then conduct repeated isolated season rehearsals with copied histories.
6. Present keep/revise/defer/drop decisions before any official adoption.

Halftime is triggered by the leading score reaching 50, not elapsed minutes. Controlled deficits and first-half evidence should drive adaptation; proximity to victory is not an independent halftime input. Distance is always measured from the coach's original root strategy.

Weather tests use prescribed conditions first. A later live-data adapter must pin location, scheduled fixture time, provider, data validity time, units, quality/fallback status and selected conditions before simulation. Retries reuse the saved weather. Wind affects action difficulty for everyone; existing skill determines execution. Heat/cold tolerance remains a separate proposal, not a change to existing ratings.

All earlier numerical suggestions are calibration candidates, not approved coefficients. No test should target a preferred club, demand parity between unequal squads, reroll disappointing results or use official competition state as its experiment store.
