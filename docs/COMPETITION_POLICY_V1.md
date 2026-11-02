# Competition availability, discipline and correction policy v1

Approved by the commissioner on November 1, 2026. This records the adopted policy for implementation and validation toward workflow 1.0. The gameplay baseline remains `0.1.0-exhibition`; feature deployment is tracked in the [1.0 roadmap](MATCH_ENGINE_1_0_ROADMAP.md).

## Fatigue and exhibitions

Fatigue remains within-match. Exhibition injuries reset at the end of the match. Exhibitions neither enforce nor serve competitive suspensions, and their results remain separate from official competitive records.

## Competitive injuries and availability

- Injuries carry forward into later competitive matches. Most absences should be short, with occasional longer injuries. Exact severity probabilities and duration distributions remain calibration work.
- Recovery runs in calendar days and continues across monthly season boundaries.
- Players must be fully recovered to be eligible initially; partially recovered participation is outside this initial policy.
- Availability and its source evidence must be pinned for each match through a versioned adapter while retaining replay support for earlier engine versions. Public player abilities remain governed by the existing generation/development model.

## Suspensions

- Reserve suspensions for serious or repeated misconduct. An ordinary in-match short-handed penalty does not, by itself, establish a multi-match ban.
- Automate clearly classified offenses under an approved penalty table. Flag ambiguous incidents for commissioner review. The precise offense categories and sanction table still need implementation and validation; aggregate foul counts are not enough to infer unrecorded misconduct.
- Count eligible official matches toward service of a ban. A suspension follows its player across transfers and monthly seasons.
- Exhibitions do not enforce or reduce these bans.

## Corrections and finality

- Only the commissioner may authorize an accepted-result correction, for a technical or administrative error such as incorrect eligibility or an engine defect. Refereeing judgments remain final.
- Preserve the original accepted payload and its audit history. Record the reason and authority for voiding/replacing a result; any replacement simulation uses the corrected, explicitly recorded inputs and engine identity.
- Flag affected later matches for commissioner review rather than automatically replaying them.
- Require explicit reopening for a correction after the competition has closed.

## Technical aborts and restarts

The commissioner's default response to a simulation aborted for a technical reason is to restart that match. The commissioner may assess the situation as it develops and choose the appropriate handling for the circumstances.

For the normal restart path:

1. Leave the unaccepted attempt outside accepted results, team records, player statistics and any persistent availability or discipline effects. Partial scores do not become an official result.
2. Check for an already saved proposal or accepted result before restarting. A lost response after a successful write is an interrupted request, not evidence that the match needs to be played again. Recover the saved record or perform the existing exact retry instead.
3. If no completed proposal/result exists, restart from the beginning using the original pinned fixture, seed, rosters, coaching and rules. Do not select another seed merely to obtain a different sporting outcome.
4. If the technical cause requires changed inputs or a different engine version, record that change and its reason under the commissioner correction process. Preserve earlier attempts and accepted records as applicable.
5. A repeated deterministic failure needs diagnosis and commissioner assessment; do not silently relax safeguards or fabricate a winner.

The existing engine guard already throws without returning a result when a safety limit is exceeded. The proposal/acceptance boundary only persists a completed proposal and counts it once after acceptance. Persistent attempt/error history and the full correction/availability APIs remain implementation work.

## Forfeits and sporting abandonment

Formal forfeits and other administrative abandonment outcomes remain deferred unless needed. A technical failure does not automatically produce a forfeit, an awarded score or invented player statistics. Any exceptional administrative disposition is assessed by the commissioner and requires an explicit policy and audited record.

## Remaining validation

- Completed: technical abort/interrupted request regression checks preserve unplayed records and recover saved records without duplication.
- Completed: [versioned cross-runtime replay comparison](REPLAY_PORTABILITY_V1.md), retaining exact match facts and explicitly bounded lateral coordinate rounding.
- Completed: [four-team, two-round live rehearsal](FOUR_TEAM_VALIDATION_2026_11_01.md) for cumulative records, partial rounds, recovery and accepted-only briefing exports.
- A [competitive operations candidate](COMPETITIVE_OPERATIONS_CANDIDATE.md) now implements/tests eligibility, recovery, discipline decisions, carryover/service and correction projections with durable validation storage. The [commissioner rehearsal transaction/UI](COMPETITIVE_REHEARSAL_INTEGRATION.md) is now deployed. Adopt/calibrate the explicit candidate choices and bind the authoritative official category-wide journal before official activation.
- Continue to defer the inaugural tournament format until the rest of the engine is ready.

## Restart/retry regression evidence

The expanded isolated database/service harness now passes 103 checks locally and 110 checks against PostgreSQL in CI. The technical-abort additions run the actual backend service against the migration and confirm:

- Two attempts at the same safety-limited fixture both abort without a proposal, accepted result, changed revision or team-record contribution; the pinned input remains unchanged.
- A simulated outage before proposal storage leaves the fixture unplayed. Restarting the original input/seed reproduces the same serialized result.
- A lost reply after proposal storage recovers the existing proposal instead of creating another match.
- A lost reply after acceptance recovers the accepted result using the original revision, with exactly one result and one acceptance audit event.

The baseline source/default guard passes unchanged. CI runs these same checks against disposable PostgreSQL and adds the existing independent-session contention tests. These checks validate the current abort/retry boundary; competitive availability persistence, failure-attempt history and the full correction API remain implementation work.
