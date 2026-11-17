# Targeted drop-and-counter test and source recovery

This is a separate mechanical experiment, with no official gameplay, roster, coach or adoption-threshold change. The fixed design is `docs/drop-counter-targeted-plan-2026-11-17.json`: maximal-pressure 50-48 halftime states only, eight oriented histories, 32 fresh seeds per history, 256 paired cases and four arms (1,024 outcomes). The arms are Hold, pressure -0.5, transition +0.5, and both together. The opponent always holds. The first two trials per oriented state/arm have exact future replays (64 scientific replay receipts).

The earlier transient checkout was missing in this session. The public source base `1f867ad5de47a6e8c40b70cbcb379e8751c72e8a` and `reproduction/source.patch` from the saved adverse-confirmation archive recovered the native v2 source fingerprint `ad8492b0fccbf45e730dffe941d9476e39c5e1d386aedbc31ac524237bbb7329`. The old halftime adapter source and raw historical future ledgers were not present remotely or in the compact archives. This adapter is new source, not a claim that those missing bytes were restored.

Qualification restores each original immutable prefix, applies each original single-slider intervention, and reproduces all 16 compact score, clock and action-count metrics for all 1,248 stored historical outcomes. Every generated qualification ledger receives independent score/statistics, clock, fatigue and eligibility audits. Native gameplay calculations match the exactly recovered v2 source after removing declared restore/intervention wiring. Four full default-off simulations match the recovered native engine. This is compact historical agreement, not byte-exact historical event reproduction; qualification data are never pooled with the fresh test. The initial qualification metadata misstated the metric field count as 18; the corrected proof records 16 and retains that correction explicitly. All emitted metric values were checked throughout.

Use Node v24.22.1 with `--no-maglev`. The native source is locked, pure dependencies are checked and official simulation-core files remain protected. TypeScript strict type checking passed. The new adapter source and harness identities are pinned before the separate eight-outcome preflight and scientific execution. Storage fault tests cover interrupted publication, duplicate writes and corrupt gzip. Two workers use eight-case chunks with 900-second limits, inside the supervisor's 15-second heartbeat and 300-second no-progress deadline. No automatic scientific retry, seed replacement or sample expansion is implemented.

All commands should be wrapped by `scripts/supervise-engine-study.py` for long stages, with separate status files for simulation, audit, aggregation, independent recomputation, archive and delivery:

```bash
node --no-maglev experiments/drop-counter/qualify.mjs RECOVERED_SLIDER_DATA NEW_QUALIFICATION_DIR
node experiments/drop-counter/test-storage.mjs STORAGE_PROOF_JSON
node --no-maglev experiments/drop-counter/run.mjs PREFIX_DIR PREFLIGHT_DIR preflight
node --no-maglev experiments/drop-counter/audit.mjs PREFLIGHT_DIR PREFIX_DIR
node --no-maglev experiments/drop-counter/run.mjs PREFIX_DIR STUDY_DIR study
node --no-maglev experiments/drop-counter/audit.mjs STUDY_DIR PREFIX_DIR
node --no-maglev experiments/drop-counter/analyze.mjs STUDY_DIR
python3 experiments/drop-counter/recompute.py STUDY_DIR
```

Qualification builds the native source and adapter; workers use the pinned compiled output. For a fresh reproduction build without repeating old scientific simulations, call `load()` in `experiments/drop-counter/tools.mjs` under the qualified runtime. It validates native and official source identities and rebuilds the adapter. Do not overwrite prior qualification directories. The qualified execution proof also records the one descriptive field-count metadata correction.

The single primary comparison is combined package minus Hold, with a fixed conservative 95% Hoeffding interval. Components, interaction, margins, rates and subgroup summaries are descriptive. This does not measure natural coaching change frequency, persistent-fatigue behavior, pre-match effects or full-stack/season performance. Keep old samples separate and do not tune a new policy to the winning cells.

The research branch is `lab/drop-counter-recovery-2026-11-17`. The initial push attempt was blocked because continuation/testing authorization did not include external code publication. After reviewing the broader laboratory scope, the owner explicitly authorized publishing this separate branch on 17 November 2026. The decision and December-season release gates are recorded in `docs/ENGINE_V2_SEASON_ROLLOUT_2026_11_17.md`. Branch publication is separate from adoption: preserve the current tournament engine, finish halftime policy and holistic validation for v2, and defer the remaining factors to a potential v3. Historical study reports keep their earlier publication-status wording as dated evidence.
