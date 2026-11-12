# Shared modifier budget and perfect-storm testing

**Status: proposed test criteria and validated scenario definitions, not adopted rules or measured combined effects.** No engine coefficient or active tournament file changes in this step. v1.0 remains frozen. Current v2.0 implements confidence/frustration only; home support, weather, temperature tolerance and halftime adaptation are still planned.

## Why change the approach

The 6,400-pair confidence study found three-win confidence +3.69 percentage points over its matched control, and five-win confidence +7.59 points. That is already too much of the proposed shared budget for one psychological mechanism. Earlier pilot estimates are historical observations, not limits we can rely on when stacking new effects.

Agree on the size of the whole stack first, then allocate smaller contributions. Do not add isolated win-rate gains to predict the combined result: probabilities, fatigue, possession, fouls and coaching interact nonlinearly.

## Provisional screening targets

All values below are **percentage-point changes in match win probability relative to the same roster/coaches under its control conditions**. They are study targets and review flags, not direct engine coefficients or artificial win-probability clamps.

| Influence | Ordinary target | Proposed peak review level |
| --- | --- | --- |
| Winning-streak confidence | About +0.5 to +1.5 points | About +3 points |
| Home support | About +1 to +2 points | About +3 points |
| Confidence, crowd support and frustration together | Small cumulative effect | About +4 points; avoid counting motivation twice |
| Losing-streak frustration | Rare disciplinary effect | Review if absolute winner-rate impact exceeds 1 point; inspect incident risk separately |
| Weather | Often little relative advantage when both clubs cope similarly | Review extreme matchup advantage above about 8 points |
| Full stack, including traits and halftime policy | Usually about +3 to +5 points | Prefer within +10 points; review above +15 points |

For a control matchup close to 50–50, prefer even the favorable extreme around 60–40; 65–35 triggers review. Check the unfavorable direction too. These numerical choices are provisional design criteria, not findings from an implemented combined model.

For stronger or weaker clubs, measure change from their own baseline. Do not clamp a legitimately dominant club to 65%, turn the weaker club into an equal, prescribe winners, force upsets or reroll inconvenient results. Zero losses in a finite sample triggers investigation and more precision; it does not prove mathematical invincibility.

A lower confidence scale of **0.35 of the tested candidate** is a starting value for a future study, not a change applied now. It would reduce three-/five-win execution-odds bonuses from 1%/2% to 0.35%/0.70%. It does not imply the match-level effect will fall by exactly 65%; it must be measured again.

## Model the mechanisms without double counting

Confidence and home crowd support should contribute to one bounded psychological adjustment at eligible execution checks, with diminishing returns and a shared ceiling. Keep frustration in the existing discipline-aware foul pathway, rather than also imposing a general ability penalty. Account for its consequences when assessing the combined psychological effect.

Weather is one shared physical environment for the match. It changes action difficulty, ball behavior and fatigue for both sides. A relative advantage can emerge because their players, tactics and rotations cope differently; do not hand one club a generic weather strength bonus. Measure absolute scoring, accuracy and fatigue changes separately from the change in who is favored.

Heat/cold tolerance should moderate the relevant weather burden, never add an unrelated permanent ability bonus. Test both normal trait distributions and deliberately pathological lab extremes (one squad all tolerant, the other all sensitive). These are synthetic stress cases, not edits to league players.

Halftime policy must select actual personnel, workload or tactical changes, with uncertainty, costs and distance from the original root strategy. It must not create an automatic comeback boost. Test neither coach adapting, each coach separately and both adapting; distinguish conditional second-half effects from pre-match winner-rate changes. A tactical correction can have a substantial effect, so do not assume it is small simply because it belongs to one coach.

## Scenarios and validity

The machine-readable plan defines 19 corner scenarios and expands them over three roster-quality relationships, two tactical contexts and both simulation-side roles: **228 planning cells**. It includes neutral controls, peak confidence and frustration, home support disappearing after five losses, favorable/adverse psychological stacks, shared wind/rain, cold and hot trait extremes, halftime-policy variants, and full favorable/adverse cold and hot cases.

Weather candidates include temperate conditions, warm wind/rain, cold wind/rain and hot/humid wind/rain. They are fixed laboratory inputs, not observed weather, approved playable boundaries or an implemented weather response curve. Heat and cold cannot be maximized at the same time; only one club can host; weather is shared. Wind/rain can combine with either appropriate thermal scenario.

Weather-fit labels require real matched-style test cohorts and their own unchanged-roster control, not a hidden buff attached to the label. Quality labels likewise require genuine generated/copied roster fixtures before execution. Adaptation enabled for one coach does not guarantee a helpful decision or assume knowledge of future outcomes.

The plan compiler reports **36 cells with currently available features and 192 blocked by missing features**. All 228 remain planning-only: compiling or validating the matrix does not simulate any of them or establish a combined ceiling.

## Execution sequence

1. Implement shared psychological accounting and fixed weather/trait responses inside the isolated v2.0 engine, with defaults off and no-feature parity preserved. Keep the existing full-study evidence intact.
2. Validate each mechanism, its saturation bounds, schema and telemetry; then screen a prespecified set of corners. Retain every outcome and balance simulation sides.
3. Search the declared playable-condition envelope and combinations for candidate extremes; do not assume one handpicked corner is the global worst case. Use leave-one-feature-out comparisons to identify which mechanism drives each extreme.
4. Confirm selected extremes using fresh seeds, adequate samples and paired uncertainty. Do not reuse the screening sample as final confirmation or stop once an acceptable result appears.
5. Record control win probability, changed winners, score margins, comeback frequency, fatigue/workloads, disciplinary incident denominators, upset counts and modifier saturation. Review both model-level bounds and measured match outcomes.
6. Repeat on copied real club rosters and isolated season histories before adoption. Official competition remains untouched until explicit approval after the inaugural tournament.

Validation commands (no matches are simulated):

```bash
node experiments/v2/validate-envelope.mjs
node experiments/v2/plan-envelope.mjs
```

The thresholds and proposed smaller confidence scale are recorded for review. They are not read by the engine, and the actual full-stack maximum remains unmeasured until the missing mechanisms are implemented and tested.
