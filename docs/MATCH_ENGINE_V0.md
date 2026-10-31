# Century exhibition engine v0.1

The first engine resolves individual actions and contests in TypeScript using the existing shared player attributes. A complete match produces the score, four quarter records, team/player statistics, a structured event ledger, a readable box score and an evidence-backed podcast briefing. No model API call is required to simulate a match.

This is an exhibition model. Its coefficients are initial simulation choices, not empirically established Century rates. Results do not update standings, player ratings, development, injuries, roster assignments or future availability.

## Approved exhibition rules

- All 35 rostered players are eligible. Normally 15 may participate at once.
- Players have no immutable positions. Initial selection seeks overlapping defensive, central and attacking coverage. Every subsequent action uses the relevant raw attributes, current location and fatigue.
- The first threshold crossed by either team at 25, 50 and 75 ends that quarter. A threshold triggers once for the match, not once per club. Full points are retained across these thresholds.
- Interval lengths are 10, 20 and 10 minutes, from the supplied rules notes. Recovery occurs during these intervals.
- Only a four-point central aerial kick can win. The winner's official score is exactly 100; all other scoring is capped at 99.
- A winning four-point kick from 97 contributes three official points and remains classified as a central aerial scoring play.
- Bonus claims accumulate. The next non-bonus scoring play converts the scoring team's claims and cancels the opponent's. The original bonus earner receives converted official points. A further bonus stacks rather than converts existing claims.
- Four-point central scoring deflections that meet master rule 9.2.1 count as qualifying central kicks. Outer aerial deflections score two and cannot win.
- Completed tackles restart through a neutral referee ball-up. Dislodged balls remain live. Clean kick catches grant protected movement; overhead ball-in catches do not.
- Pending short-handed penalties begin at the next ball-up/restart following assessment. Their countdown uses playing time; scoring does not release them. Intervals and stoppages do not consume penalty time.
- Within-match injuries remove a player for that exhibition. All availability and fatigue start fresh on a new simulation; the input records are never mutated.

## Explicit experimental administration

Standard and serious short-handed penalties initially last 120 and 300 playing seconds. A provisional floor of 12 on-field players applies to simultaneous penalties; further penalties wait for a subsequent restart with capacity. These are tunable exhibition settings, not permanent league amendments.

Score capping allocates the current kick's points first, then held bonuses in chronological order. Uncreditable excess points are retained as `pointsCapped` rather than credited to any player. Even a capped non-bonus scoring play at 99 resolves pending bonus claims; it cannot win without the qualifying kick. Bonus attempts restart at center but are not themselves bonus-converting point scores. These interpretations are explicit so they can be changed without editing unrelated mechanics.

## State and actions

The engine tracks ball coordinates on a 150 × 95 metre field, the current carrier, protected movement, score eligibility after a no-score free kick, pending bonus ownership, delayed advantage, penalty clocks, fatigue, availability and authorized interchanges. Scoring targets are offset laterally. The model is spatially approximate: event-level movements and probabilistic contests replace detailed trajectories and collision physics.

Initial coverage is not a formation: there are no stored positions. Supporting depth changes with continuous role strengths, possession, ball location, coaching posture and transitions. Width influences lateral targets. Players moving toward an interchange gate remain active until reaching it; their replacement then enters at the gate. A player cannot be swapped into the ball carrier's location. During intervals or an injury stoppage, the coach can change personnel without waiting for live movement to the gate.

Action probabilities use relevant attributes and fatigue, not Overall plus a second bonus for the same underlying ability. Low energy reduces effectiveness. Pressure, movement and contact preferences increase workload; stamina slows depletion and recovery speeds replenishment. Coaches prefer fresher suitable substitutes but are not obliged to use all 35 players.

Ten existing tendencies control tempo/action duration, contact appetite, defensive posture, pressure, counterattack support, width, aerial preference, disposal risk, running and challenge timing. They are preferences with costs, not coach ability ratings. No personality or drafting-priority attribute bonuses are introduced.

The engine includes ordinary overhead ball-ins, no-score and score-allowed free kicks, advantage recall and the optional kick-back following a score during advantage. All free movement is protected until disposal, established running or loss of control. Fouls are currently generated as an aggregate contact model; the full taxonomy of bench misconduct, retaliation and disciplinary escalation is not yet generated. Deliberate backwards carries through the opponent's goal are not currently selected by the action policy. These are remaining extensions before comprehensive official-rule coverage.

## Time and calibration

Playing, stoppage and interval time are distinct. Playing time governs exertion, minutes played and experimental penalty service. Bench rest, stoppages and intervals permit different recovery rates. Quarter lengths emerge from scoring. The initial batch benchmark is around 80 playing minutes, not an enforced match duration. Safety limits abort a pathological simulation with an error rather than manufacturing a winning score.

The six pairings among four selected clubs are each repeated with seeded variation and alternating sides. Asheville Highland and Anacostia United provide broad functional coverage; Lancaster Red Rose CC emphasizes finishing; Hampden Works CC emphasizes defense/aerial play. Selection used the actual 35-player rosters and their attribute coverage, not best-role labels as fixed positions. The diagnostics compare scoring, shooting, catches, tackles, participation, duration and repeatability. Win percentages are diagnostics, not power rankings or a target of equal team strength.

## Outputs and statistical definitions

- `exhibition-*.json`: complete event ledger, public input snapshot, rules configuration, quarter scores and box scores. No hidden development variables are included.
- `exhibition-*.md`: human-readable report, quarter scores and all 70 player lines.
- `exhibition_teams.json`: the four selected public match rosters/coaches and provenance.
- `round_briefing.json`: six first-seed fixtures with top scorers, scoring runs, lead changes, largest lead, winning plays and incident event references. Exhibition standings are deliberately absent.
- `calibration.json`: all repeated-match diagnostics, team aggregates and measured runtime.

Player minutes come from replaying lineup, substitution, injury, penalty and playing-time events. `points` are official awarded points. Scoring-category counts describe what happened before capping, so `4 × centralAirScores + ...` can exceed official points; the scoring ledger explains the difference. Converted bonuses belong to their original earner. A successful non-grounded outer deflection has its own scoring category. `completedPasses` counts controlled team receptions. `turnovers` counts disposal losses, not every neutral contest lost. `possessionSeconds` excludes unowned ball-up time and is an event-based approximation, not a tracking-system measurement. No assist statistic is invented before an assist-credit definition is agreed.

All summary claims must be traceable to these records. The briefing provides observations, not invented crowd reactions, quotations or guaranteed tactical explanations.

## Running and replaying

```bash
npm install
npm run validate:matches
npm run simulate:exhibitions -- --players /private/canonical_players.json --draft /private/Century_Draft_State_After_Round_35.json --coaches /private/century_founding_coaches.json --output /private/exhibitions --repeats 10
node scripts/replay-exhibition.mjs /private/exhibitions/exhibition-12-001.json
```

The importer joins all 630 draft UUIDs against the canonical snapshot and requires 18 clubs with 35 unique players each and one coach per club. It rejects invalid ratings or duplicate players, and strips private development fields from the match inputs. Keep the raw founding population and generated results outside the public repository. The CLI can be run locally or by a suitable GitHub workflow; the core has no Node-only dependencies and can also be bundled into a browser interface later. There is no browser UI or scheduled official match runner in this change.

Persist the complete result file, the seed and the matching source version. `replay-exhibition.mjs` compares every event and statistic, not merely the final score. A rerun produces files only; it cannot double-count league standings because no result-commit operation exists in this exhibition release.

### Eight-team match-variation study

`scripts/analyze-match-variation.mjs` runs 30 independent exhibitions per pairing among the original four clubs plus Wilmington Cape CC, Erie City Rovers, Frederick Forge and Greensboro Crescent CC: 28 pairings, 840 matches and 210 appearances per club. Simulation sides alternate evenly within each pairing. The runner freezes the existing v0.1 engine, roster ratings and coach tendencies, and resets fatigue and injury availability before each fixture.

Use `npm run analyze:matches -- --players /private/canonical_players.json --draft /private/Century_Draft_State_After_Round_35.json --coaches /private/century_founding_coaches.json --output /private/variation-study --repeats 30`. An optional `--teams` file can supply eight distinct existing club names. Atomic per-pair checkpoints allow an interrupted run to resume only when its manifest matches the source and inputs.

Outputs distinguish series predictability from individual-match variation: series splits, sweeps and strongly favored pairings; distinct scorelines, margins and time distributions; team statistics; quarter and player point reconciliation; and seeds/public match inputs. The runner preserves one full event ledger per pairing plus every match's compact record and player box score. Thresholds such as 24–6 and 27–3 are descriptive diagnostic flags, not targets that the engine tries to produce.

For a paired neutral-coaching control, add `--neutral-coaches --baseline /private/variation-study` and choose a new output directory. This sets all ten existing preference sliders to 3 without editing the original coach records or any player attribute. The engine, default match rules, club selection, raw source snapshots, repetitions, seeds and side assignments must match the baseline; mismatches are rejected before simulation.

The control writes `paired_comparison.json` with both condition summaries, club and series changes and all matched fixture outcomes. Universal lineup and substitution logic remains active. Original rosters still reflect their coaches' draft choices. Identical seeds provide reproducibility, but changed decisions can alter subsequent event sequences, so random draws are not aligned action-by-action and the count of changed winners is descriptive rather than a percentage of victories caused by coaching. Small series changes need additional sampling before strong conclusions.

### Opportunity and rare-upset audit

`scripts/audit-match-engine.mjs` audits possession gains, pass retention and shot creation from the neutral study, then extends each swept pairing with a predeclared fresh sample (default 500 matches per pairing). Use `npm run audit:matches -- --study /private/neutral-study --output /private/upset-audit --stress-matches 500`. It verifies the engine hash and neutral inputs, balances simulation sides and completes the full sample regardless of when an upset occurs. No match-outcome floor, coefficient change or prescribed winner is introduced.

The fresh samples are reported separately from the 30-game series that selected the matchups. Wilson intervals describe observed upset rates; a finite winless sample is not interpreted as zero probability. Compact records preserve every outcome, team box score and observational control-sequence metrics. Complete event ledgers preserve every underdog victory plus first trials and closest losses. Control sequences end at opponent control, restarts, completed tackles, ball-ins or scores; same-team recoveries continue the sequence. Shot and official-point totals reconcile with match statistics.

In the initial frozen-engine audit, Wilmington won 9/500 against Erie and 20/500 against Frederick under neutral preferences. Thus both previously swept matchups produced reproducible underdog victories with unchanged players and mechanics. At those observed rates, the plug-in estimates of a fresh 0–30 series are about 58% and 29%. These are estimates for these conditions, not universal team win probabilities or a requirement to equalize teams. Team-strength differences remain part of the model.

### One-club full-league sampling

`scripts/analyze-club-opponents.mjs` profiles one club against every other drafted team. Use `npm run sample:club -- --players /private/canonical_players.json --draft /private/Century_Draft_State_After_Round_35.json --coaches /private/century_founding_coaches.json --club "Wilmington Cape CC" --output /private/club-study --repeats 50 --condition original`. This completes 17 × 50 = 850 fixtures, balancing simulation sides 25 times each per opponent. Every fixture starts rested and healthy.

Repeat with `--condition neutral` to produce a separate paired control using the same seeds and side assignments. Both clubs' ten preferences are neutralized; the comparison therefore measures the combined tactical matchup rather than isolating the selected club's own coach. Each condition records opponent splits, Wilson intervals, opportunity metrics, all player box scores, compact match records and one complete replay ledger per opponent. Atomic opponent checkpoints preserve completed series and reject changed manifests. The 850-match record is a one-club profile, not a complete league standings simulation.

### Full-league balance and roster-repair studies

`sample:league` completes every unordered pairing of all 18 drafted clubs. The default 50 fixtures per pairing produces 153 series, 7,650 matches and 850 appearances per club. Each series balances the two simulation sides 25 times each. These are neutral exhibitions without a home-advantage coefficient. Coaches retain their original preferences; fatigue and injury availability reset for each fixture.

```bash
npm run sample:league -- --players /private/canonical_players.json --draft /private/Century_Draft_State_After_Round_35.json --coaches /private/century_founding_coaches.json --output /private/league-study --repeats 50 --workers 6
npm run probe:roster-repair -- --study /private/league-study --players /private/canonical_players.json --output /private/repair-probe
```

The league runner distributes independent series across Node worker threads. Worker count does not affect fixture IDs, seeds or side assignments. Atomic pair checkpoints and a strict manifest guard support resuming an interrupted study. Every new match reconciles all credited player statistics, official points, quarters and playing time. Output retains every match's player/team box scores and one complete event ledger per pairing. Team indices in compact records identify canonical clubs; score/team-stat/quarter arrays are normalized to the pair's `a,b` order, while a player's `side` retains the original simulation side and `teamIndex` identifies its club.

Summary bands below 25%, 25–75% and above 75% are descriptive, not parity targets. Pairwise Wilson intervals describe sampling uncertainty. Aggregate club intervals summarize a fixed balanced opponent mix; they are not forecasts against an arbitrary schedule. A finite sweep does not establish impossibility, and rating/result correlations alone cannot validate the engine's weighting of different styles.

The separate repair probe uses Wilmington's established ball-winning deficit as a hypothesis. It replaces eight players with actual undrafted founding players in hypothetical inputs only. Departures have the lowest mean of the ball-up and ground-contest attribute formulas among players with at least five quality-matched candidates. A candidate must be within 0.25 of the outgoing player's computed Overall and within 0.5 of its raw attribute mean. One variant maximizes ball-winning attributes; another selects the closest Overall/raw-mean match without considering that skill. Both use the same departure slots, no duplicated signing within a variant, original coaching, three fixed opponents (Manchester, Anacostia, Erie), 50 seeds per opponent and balanced sides. The separate baseline uses identical seeds and sides. All 450 fixtures complete irrespective of results.

The probe records sanitized rosters, exact replacements, matching constraints, seeds, outcomes and nine complete replay ledgers. It tests whether modest, actual-pool recruitment can change performance under the frozen engine. It does not simulate contract availability, prove optimal recruitment, measure long-term development, or establish that the current contest weights are the best interpretation of Century. Do not apply its hypothetical signings to the canonical draft.

## Verification

`validate:matches` exercises every score from 0–99 with each scoring category, bonus ownership/cancellation/caps, post-victory rejection, exact replay, input immutability, quarter and score reconciliation, player participation, on-field limits, penalty countdowns, injury stress cases, genuine ability differences and safe abort behavior. Existing player-generation, lifecycle, pool, edge-mirror, type and registry build checks remain applicable.
