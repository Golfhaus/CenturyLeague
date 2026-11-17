# Control-only quality ladder and conditional fresh modifier validation

Fixed before new outcomes, November15 user-facing date. Both stages laboratory only; current weather/thermal/psychological coefficients, frozen v1.0, real players/coaches and official results stay unchanged. Earlier breadth results (including saturated controls) are retained and never pooled. The purpose is to obtain genuinely moderate rating-defined mismatches and independently test fixed modifiers there, not to tune the engine into specified winners.

## Generated inputs and stage1

Four new fixed synthetic templates, 35 players, attribute SD1.5 about mean11, clipped[1,20], from named generation seeds independent of earlier populations. Within each template the focal and opponent mirror the same latent player-by-player skill pattern. Opponent mean offsets are **−0.50,−0.35,−0.20,−0.10,−0.05,0,+0.05,+0.10,+0.20,+0.35,+0.50**. They are explicitly generated counterfactual rating variants, not edits to founding players or hidden strength multipliers. Synthetic identities remain stable within a template across variants, holding later player-ID thermal propensities fixed. Every exact version is retained in profiles.json. Zero gap is genuinely equal-ability by construction; observed results are not forced to50%.

Neutral tactics all3; pressure applies equally to both teams (pressure5, defensive_aggression5, physicality4, running_movement_emphasis5). Four templates×11offsets×2tactics=**88 profiles**. Stage `quality-control-ladder-001`: **64 new side-balanced seeds/profile**, 32 each simulation side, **5,632 control-only matches**. Neutral dry18 with psychology off and no active thermal tolerance, fixed date2026-11-15 and healthy availability reset. First2/profile replay; 176 frozen v1.0 parity checks. All fixtures retained; no reselecting seeds, result-driven extensions or coefficient changes.

## Prespecified selection, after full stage1 verification

Each offset pools eight fixed contexts, n512. Report raw wins and Wilson intervals protected as one family of11 rates (z=NormalDist.inv_cdf(1−.05/(2×11))). These are eligibility-screen intervals, not a universal population claim. Preserve each tactic/template/side separately too.

Zero-gap pooled interval must lie wholly in[40%,60%]. For a positive magnitude g to qualify, the +g opponent (focal-weaker) interval must lie wholly in[20%,45%] and the −g (focal-stronger) interval wholly in[55%,80%]. Each tactic's pooled point estimate must lie in its corresponding interval range, and no individual64-match context at ±g or0 may be all wins/all losses. No cap, forced parity or replacement applies.

Among eligible magnitudes choose the one minimizing |p(+g)−.35|+|p(−g)−.65|, with smaller g breaking exact ties. Implement the ranking with equivalent integer score |20w(+g)−7n|+|20w(−g)−13n| to avoid floating tie ambiguities. All five candidates remain visible. No eligible gap or failed audit means no stage2 and no grid extension. Positive and negative counterparts are selected together; never mix independently selected gaps. This selects test fixtures, not modifier effectiveness; independent follow-up seeds prevent pooling/selection leakage.

Selection can authorize stage2 only after stage1 full ledger/input/hash/CRC/score/statistics/clock audits and independent recomputation/selection proof pass. Gate records exact source/harness/data evidence hashes. Test-only gates allowed only for reserved qualification IDs.

## Stage2 fixed in advance, conditional on eligibility

`moderate-quality-modifier-validation-001`: retain all four templates and both tactic settings at offsets **0,+g,−g**, 24profiles. **96 fresh seeds/profile**, 48 per side and32 per moderate regime (16 per side/regime), **2,304 clusters×9arms=20,736 outcomes**. None of the5,632 pilot outcomes enters this analysis. Do not reselect or expand if fresh controls fail the pilot classification; retain/report the failed generalization.

Use the exact prior nine-arm breadth constructors (date2026-11-15): neutral; ordinary favored/adverse (±2streaks/home, independent normal thermal traits .35, dry22/warm28/mild-wet18 regimes); peak psychology favored/adverse alone (±5/home); hot/cold combined favored/adverse (opposed relevant thermal extremes0/1, .35; hot35C, cold−5C with original wind/rain). Confidence .20, home odds .004, shared positive cap .006, frustration1. No halftime or season carryover. Rosters/tactics identical across arms within each profile. First2/profile/arm replay=432 outcomes;48 frozen neutral checks.

Do not pool quality strata. Separate protected families: six ordinary contrasts (three qualities×two directions); six peak-psychology contrasts; twelve hot/cold combined contrasts. Protection is separate across these families. All template/tactic/regime/side/profile intervals exploratory nominal. Retain win rates, changed-winner counts, score margins, duration, energy/fatigue/shots and disciplinary denominators/cap saturation. Compare ordinary3–5 preference, psychology4 and extremes10/15 references while retaining uncertainty; this fixed initial follow-up is not a precision ceiling certificate.

Fresh quality control rates use a separate family of3 Wilson intervals. Label matched compatibility with[40%,60%], weaker[20%,45%], stronger[55%,80%], and disclose all individual/tactic controls. Classifications do not change the sample. Synthetic mirror templates isolate an ability axis; they are not a league-wide roster sample, actual teams, or a completed all-weather/halftime/season validation.

## Qualification, supervision and delivery

Original lab fingerprint ad8492b0fccbf45e730dffe941d9476e39c5e1d386aedbc31ac524237bbb7329 stays unchanged. Pin both stages' scientific harness and this plan separately before pilot outcomes. Verify all88profiles/arms/sides and nine-arm equivalence to the previous breadth constructors; qualified no-Maglev Node24.22.1; exact neutral/v1 parity; save/resume and corrupted-result rejection; small full audit and independent analysis; selection unit cases (eligibility, ties, no candidate, bad balanced controls and unauthorized test gates).

Eight workers, atomic fixture gzip checkpoints,15sec heartbeat and300sec no-progress limit. Separate supervised simulation/audit/analysis/recompute/selection/report/archive/delivery stages. No automatic simulation retry or uncertain-write retry. Scientific completion is separate from delivery. Save compact report/data/source first; full event ledgers separate. Source archive and stage receipts/version identity preserved. Nothing is adopted, deployed or written into official competition state.
