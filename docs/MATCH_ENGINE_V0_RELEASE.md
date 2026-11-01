# Match Engine v0.1 — adopted baseline

Adopted November 1, 2026, following the commissioner’s approval to make the tested engine permanent. This release promotes the existing tested implementation into the default repository branch. It changes no gameplay coefficients, player ratings, tactical sliders, random draws, score rules or saved results.

The engine identity remains `0.1.0-exhibition`. That string participates in random-seed construction; renaming it solely to remove the suffix would change results. It identifies a permanent, reproducible baseline with an exhibition-oriented persistence policy.

## Adopted behavior

- Actual 35-player drafted rosters, normally 15 on-field players, fluid deployment and unlimited authorized substitutions.
- Relevant continuous player attributes, coach preferences, match fatigue and event-level spatial movement determine actions and contests. No team-identity bonuses or prescribed winners.
- Four/two/one scoring, held bonuses and the qualifying central-air winning kick, with official scores capped at 100 and other scoring capped at 99.
- Score-triggered 25/50/75 breaks, full points retained, and 10/20/10-minute intervals.
- Seeded full event ledgers, reconciled player/team statistics, quarter scores, match reports and structured round briefings.
- Existing v0.1 defaults, including 120/300-playing-second penalties and a twelve-player floor. These are simulation settings within the rulebook’s league-policy discretion, not new rulebook text.
- Rested/healthy inputs for exhibitions; no write to standings, player development or future availability.

## Release evidence

The scoring/match validator passes 549 checks, including caps, bonus ownership, winning-play eligibility, replay, input immutability, legal participation, injury/penalty stress cases and delayed advantage. The full GitHub CI also checks types, generation, lifecycle, player-pool behavior, player creation, backend-mirror consistency and the registry build.

Recorded calibration includes 7,650 original-coaching full-league matches, the two final style diagnostics totaling 1,000 matches, and the nine-match all-club exhibition round. Every retained full-league replay (153), final-style replay (20) and all-club replay (9) reproduced exactly. Earlier original/neutral-coaching samples and fixed rare-upset audits remain historical evidence. No result-based rerolls or parity tuning were introduced.

The release manifest at `packages/simulation-core/releases/match-engine-v0.1.json` records the adopted defaults and the exact gameplay source fingerprint:

`9513ba17bef8814027cc3408731f7d26db9c8ce8cd5a25f52c42175286db3521`

This is the same fingerprint used throughout the accepted diagnostic studies and exhibition round. The gameplay source first reached that state at commit `ebd0a56161e2536fdaa167f376f05b3b303dc9bd`.

## Accepted limits

This is an event simulation, not detailed ball/collision physics. Strong possession-winning ability compounds across repeated contests; equal Overall or role ratings do not imply equal true match strength or universal style viability. Coaching and disposal selection use approximate preferences and are not an optimal tactical planner.

The foul model generates aggregate contact infractions and delayed short-handed penalties. It does not generate the complete rulebook taxonomy of bench misconduct, retaliation, offset fouls, dissent or repeat-offense escalation. Deliberate backwards carries through the opponent’s scoring zone and the associated special restart are not selected by the current action policy. These remain explicit rule-coverage extensions.

The current release produces match results and supporting evidence. Browser UI, official competition scheduling, durable result commits, standings, persistent injuries/fatigue and cross-match disciplinary administration are outside this core release. Integrating those systems requires their own policies and persistence work; adopting the core does not silently activate them.

## Running and preserving results

```bash
npm install
npm run verify:match-baseline
npm run validate:matches
npm run simulate:round -- --players /private/players.json --draft /private/draft.json --coaches /private/coaches.json --round-id exhibition-round-02 --output /private/round-02
node scripts/replay-exhibition.mjs /private/round-02/exhibition-round-02-01.json
```

Retain complete inputs/results, engine identity, rules configuration, seeds, source fingerprint and execution environment. Keep raw founding data and hidden development fields outside the public repository. The public importer exports only match-relevant public ratings.

CI runs `verify:match-baseline` before match validation. It compares the source fingerprint, engine identity and default configuration with the release manifest. Because shared config/types are included, changes there also require a compatibility review even when motivated by another subsystem.

## Future changes

Ordinary report/UI improvements can use this baseline without retuning its outcomes. Gameplay changes require a clear version/compatibility decision, a recorded problem and appropriate targeted regression/calibration checks. Preserve historical replay support and never silently reinterpret old results or overwrite this release fingerprint merely to make a failing check pass. Retain the existing version for as long as it is used to reproduce saved matches.
