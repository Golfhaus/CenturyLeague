# v2.0 confidence and frustration: first studies

These are isolated laboratory results. The active tournament remains v1.0; no official source, result, roster, availability record, schedule or deployment changed. Neither candidate is adopted or fully calibrated.

## Experimental design

The initial pilot used 128 matched fixture seeds and six conditions, producing 768 engine results. After the pilot's confidence estimates varied sharply by tactical profile, a fixed larger fresh-seed replication used 256 matched seeds and the same six conditions, producing 1,536 results. All 2,304 outcomes were retained, with no coefficient changes, outcome-based rerolls or early stopping. The fresh replication is reported separately rather than presented as a preplanned pooled sample.

Both studies used two synthetic mirror-roster profiles: neutral tactics and higher-pressure tactics. Each pairing had equal simulation-side exposure. These are controlled equally rated opponents, not real clubs or manually changed league players. Injury/fatigue rules and scoring remain those of the frozen engine; every fixture starts with independently pinned healthy lab availability.

Candidate source: `87c0c2d7c02489a1ec3152984c109cec1e534ee7`. Laboratory source fingerprint: `b55d975cd27f6862dc52f4a3b0a48687368fa79a6f115ca706b3cf1f7a14eba2`. Runtime: Node v24.22.1.

## Fresh-seed replication

Each row contains 256 matches. Changes are percentage points relative to the same-seed control, not relative percentages.

| Condition for the focal club | Wins | Win rate | Change versus control | Approximate conservative 95% interval for change |
| --- | ---: | ---: | ---: | --- |
| No modifiers | 128 | 50.0% | Reference | — |
| Three consecutive wins; confidence only | 139 | 54.3% | +4.3 points | -6.5 to +15.0 points |
| Five consecutive wins; confidence only | 138 | 53.9% | +3.9 points | -7.6 to +15.3 points |
| Three consecutive losses; frustration only | 128 | 50.0% | 0.0 points | -1.9 to +1.9 points |
| Five consecutive losses; frustration only | 128 | 50.0% | 0.0 points | -1.9 to +1.9 points |
| Three wins versus three losses; both effects | 138 | 53.9% | +3.9 points | -7.0 to +14.6 points |

The paired intervals combine Bonferroni-adjusted Wilson intervals for positive and negative winner discordance. They are approximate and deliberately do not collapse to zero when no winners change. These exploratory comparisons are not a final calibration acceptance test.

## Confidence interpretation

At three wins, the candidate adds 1% to execution odds, not one percentage point to every success probability; at five or more wins, it adds 2%. It affects contested ball-ups, ground recoveries, disposal accuracy and central shot outcomes, without changing stored attributes or adding random draws. Equal confidence cancels in opposed contests.

The initial pilot's observed win changes were +5.5 points for three wins and +11.7 points for five wins. Fresh-seed changes were +4.3 and +3.9 points. The instability across profiles and seeds shows why the pilot alone should not determine the coefficients. The five-win coefficient is mechanically larger even though its observed win count is one lower in the fresh replication; sampling and divergent match paths can reverse small sample rankings.

**Decision:** retain the candidate, leave its coefficients unchanged, and use a higher-precision fresh-seed study across more roster/coach profiles before deciding whether the intended 2–4 point advantage has been met. The current uncertainty includes both no effect and effects larger than intended.

## Frustration interpretation

The baseline engine classifies an existing foul as serious with a 9% probability. The candidate raises that conditional risk by 2% relative per loss beyond the first, capped at 8%, then damps the extra effect using existing Discipline. For Discipline 11, three losses produce 9.18%, and five or more losses produce 9.36%. Ordinary foul occurrence, offense categories and penalty consequences are unchanged.

Nine controlled million-opportunity uniform threshold sweeps verified severity probabilities for three Discipline values and three losing-streak lengths. These sweeps verify the probability calculation; they are not nine million simulated matches or an empirical claim about human behavior.

In the fresh replication, three-loss frustration changed no immediate severity classifications. Five-loss frustration changed one, but no winners. The combined condition changed one classification on the losing opponent and one eventual winner, in the direction opposite to the expected average benefit; a local change can redirect later play rather than guaranteeing a particular match outcome.

Observed severe-foul totals therefore need denominators and cannot alone validate the mechanism. For example, the fresh five-loss arm produced 76 serious fouls in 643 foul opportunities, versus 77 in 646 in the control, even though its recorded conditional probability increased. That does not reverse the implemented probability change: after a changed draw, the match generates a different sequence of future incidents.

**Decision:** retain this as a very conservative candidate. It is probably too rare to notice consistently in individual matches; a larger incident sample and an explicit judgment about desired visibility should precede any increase. No automatic retaliation or bench-misconduct taxonomy has been added.

## Verification and evidence

All results reconciled scoring, quarters, winning kicks and player/team statistics. Each study fully replayed its first fixture per profile/condition and checked the corresponding controls against frozen v1.0. Separate checks verified no-feature and zero-coefficient equivalence, enabled-feature replay, capped streak curves, independent toggles, immutable input ratings, availability exclusions, resumption and corrupt-ledger rejection. The 64-file v1.0 source lock passed before and after the studies.

Detailed aggregate data is in [confidence-frustration-2026-11-11.json](verification/confidence-frustration-2026-11-11.json). The [study archive](verification/streak-studies-2026-11-11.tar.gz) preserves manifests, summaries and all compact outcome rows with result checksums. Full sporting ledgers can be regenerated from the pinned commit and saved seed/input specifications; they were not added to the public repository.

Reproduction commands from the pinned source commit:

```bash
node experiments/v2/validate.mjs
node experiments/v2/validate-streaks.mjs
node experiments/v2/run-streaks.mjs --study-id streak-pilot-001 --trials 64 --workers 4
node experiments/v2/run-streaks.mjs --study-id streak-confirmation-001 --trials 128 --workers 4
```

The confidence/frustration candidates remain default-off in v2.0, and v1.0 is unchanged. Official adoption still requires commissioner approval after the inaugural tournament.
