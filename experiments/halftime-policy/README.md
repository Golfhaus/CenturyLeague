# Restored automatic halftime policy and natural-history validation

This independent laboratory fork integrates automatic coaching decisions into naturally played matches. Official simulation-core, scheduled tournament runners, the frozen v2 native source, earlier study adapters and published outcomes remain unchanged. The December rollout boundary is in `docs/ENGINE_V2_SEASON_ROLLOUT_2026_11_17.md`.

The policy semantically restores the earlier graded candidate under the new identifier `restored-halftime-policy-v1`; it does not claim byte restoration of the lost original source. Thresholds, action costs, recipes and vetoes are unchanged and were not selected from the single-slider or package winners. All 96 stored policy choices and distances, and 96 stored diagnostic choices, match the recovered historical prefix records.

At the natural score-triggered halftime, the engine preserves the native interval and personnel review. The policy can see the public first-half shot/disposal totals, score, its own active players' ratings and recovered energy, its own pre-interval energy/stints, original tactical root and its own native personnel-review events. It cannot see opponent ratings/energy, the opponent's new decision, future match events or future random draws. Both observations/decisions are built before either effective tactic is applied. Native personnel decisions and fatigue recovery are not overwritten.

Recipes are conserve, press, aerial, lower-aerial and drop-counter, with half/full steps, at most two sliders changed and root L1 distance at most two. Every slider remains 1..5. Pressing cannot be chosen while leading/tied or below the energy veto. Major changes require stronger evidence and reliability. Hold remains a legitimate decision; no desired winner or required adoption rate is imposed. Input defaults are off and match the native engine exactly. Enabled Hold preserves sporting play; decision metadata is explicit and consumes no RNG.

Qualification passed six exact default-off comparisons, six Hold sporting-equivalence comparisons, six exact enabled replays and six paired first-half checks, plus targeted fatigue, close-threshold, leading-team, empty-evidence and mutation checks. The excluded preflight uses two different seeds, both orientations and neutral/maximal roots, eight outcomes and eight exact replays. Shared atomic storage is unchanged from the fault-tested component; its checksum is checked before execution.

The fresh plan is `docs/halftime-natural-policy-plan-2026-11-17.json`: 24 fixed synthetic profiles (four roster templates, opponent offsets -0.35/0/+0.35, neutral/maximal roots), 16 fresh seeds per profile, 384 paired cases and four arms (1,536 outcomes). Arms are neither adapting, focal only, opponent only and both. Original focal orientation is balanced. The first two trials of every profile/arm receive exact replays: 192 scientific outcomes. Every ledger is independently audited for score/statistics, clock, energy, eligibility, tactics, own observation reconstruction and first-half equality. Any policy no-op must match the same-seed control's play.

The single primary contrast is focal-only minus neither adapting on pre-match focal win probability. Before any scientific outcomes were generated, the interval specification was amended prospectively from pooled binomial discordance bounds to a conservative Hoeffding bound appropriate without homogeneous-profile assumptions. The original design and amendment are preserved. All inputs, seeds, candidate formulas, counts and arms are unchanged. Other arm comparisons, interaction and decision-coverage splits are descriptive. This is functional/natural-history validation and isolated effect estimation, not policy optimality or holistic release acceptance.

Use Node v24.22.1 with `--no-maglev`. Qualification builds the native and policy modules once; workers validate the source identity of the existing build. Run long commands within `scripts/supervise-engine-study.py`, using separate stage-status files. Two workers process eight-case chunks with a 900-second limit. There are no automatic retries, seed replacements or sample extensions. Preserve every source/runtime/plan/profile/harness identity on explicit resume.

```bash
node --no-maglev experiments/halftime-policy/qualify.mjs PREFIX_DIR PROFILES_JSON NEW_QUALIFICATION_DIR
node --no-maglev experiments/halftime-policy/test-policy.mjs PREFIX_DIR BEHAVIOR_PROOF_JSON
node --no-maglev experiments/halftime-policy/run.mjs PROFILES_JSON PREFLIGHT_DIR preflight
node --no-maglev experiments/halftime-policy/audit.mjs PREFLIGHT_DIR PROFILES_JSON
node --no-maglev experiments/halftime-policy/run.mjs PROFILES_JSON STUDY_DIR validation
node --no-maglev experiments/halftime-policy/audit.mjs STUDY_DIR PROFILES_JSON
node --no-maglev experiments/halftime-policy/analyze.mjs STUDY_DIR
python3 experiments/halftime-policy/recompute.py STUDY_DIR
```

For a fresh reproduction build, call `load()` from this experiment's `tools.mjs` under the pinned runtime. Compact aggregate recomputation needs only the CSV, analysis and manifest plus Python. Full ledgers remain separate from the small review bundle. Candidate adoption still requires broader/persistent-fatigue and holistic v2 validation, an isolated season rehearsal and the later release decision; v3 factors remain out of scope.
