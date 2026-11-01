# Path to Match Workflow 1.0

The accepted gameplay baseline is v0.1 (`0.1.0-exhibition`). Its source/default fingerprint and historical replay support remain protected. A workflow version is separate from the gameplay identity; adding competition administration must not accidentally reseed or rebalance accepted matches.

## Completed: v0.2 result/competition foundation

- Explicit competition/season/category scope and pinned rosters, coaching, rules, fixture IDs and seeds.
- Separate simulation proposals and validated result acceptance.
- Exact retry safety, conflict rejection, revision gates and immutable accepted payloads.
- Record tables derived from accepted results; ranking only under an explicit policy.
- Checksummed atomic local rehearsal adapter and CLI; independent-writer conflict tests.
- Draft import proposal generator using the existing public canonical importer.
- Atomic backend founding-roster importer, canonical live import and pinned season rosters.

This increment is implementation work toward 1.0, not a declaration that official competition administration is deployed.

## Live roster import completed November 1, 2026

The CenturyLeague database has 900 active men's players, 18 teams, 18 original coaches and 630 assigned players, exactly 35 per team. The remaining 270 players are unassigned. Men's Season 1 points to the November 2026 Inaugural Tournament and remains in setup; the women's league is planned and uninitialized. There are no competition or match-results tables.

The canonical import completed atomically, preserving all current player abilities, existing snapshot fields other than the initially empty team assignment, private development metadata and original coach profiles/preferences. It recorded draft history, 18 public match-team season snapshots and an audit receipt. Exact retry returned the same receipt without additional writes. See [the import record and backend contract](FOUNDING_ROSTER_IMPORT.md).

## Implemented: authoritative exhibition acceptance and commissioner surface

The additive database migration, backend-only transactional RPCs and authenticated `manage-matches` endpoint are deployed. Definitions, canonical season-roster links, immutable fixture inputs, generated proposals, insert-once accepted registrations and audit records are persisted. Compact security-invoker views derive fixture status and unranked exhibition records from accepted results. Exact retries do not increment records twice; stale different-fixture writes require a refreshed revision.

The Match Center is implemented in the registry and staged in the engine PR: explicit exhibition creation, activation, simulation, proposal review, acceptance, saved-result reopening, replay verification, box scores and accepted-only round briefing exports. Its backend computes proposals from pinned inputs and derives the commissioner identity from a verified session. Browser roles cannot send result ledgers or call write RPCs. See [database workflow and validation](MATCH_WORKFLOW_DATABASE.md).

Local isolated database/service tests pass 61 checks; CI additionally uses a disposable PostgreSQL service for independent-session contention and rollback tests. The live permission probe rolled back without leaving competition/match records. The accepted gameplay source/default fingerprint is unchanged.

## Remaining integration and release checks

- Publish the tested commissioner surface through the normal repository workflow and verify a signed-in session against the live endpoint.
- Complete a representative exhibition through the deployed UI, reopen it after interruption, verify its replay and inspect accepted-only round exports. Keep it explicitly separate from the inaugural competition.
- Before official activation, supply versioned availability/discipline policy and any required audited correction/void authority; preserve v0.1 replay support. Enable competitive creation only after these requirements and the eventual format are supplied.
- Confirm database result persistence/authorization and commissioner workflow acceptance before declaring 1.0. The portable local rehearsal adapter remains useful for offline tests, but is not a second authoritative live store.

## Competition policy and scheduling

The commissioner has deferred the inaugural format until the rest of the engine is ready. Continue database acceptance and workflow implementation using explicit disposable test fixtures. Format selection is not a blocker for that work. Before official fixtures are generated, confirm the format for the current 18 teams and define standings points, tie-breaks, knockout/series advancement and correction/forfeit authority where relevant. The new core accepts an explicit fixture list and does not assume a tournament structure or import an older entrant count.

Later monthly scheduling must preserve the independently agreed competition structure and rest constraints when those are supplied as current scheduling policy. Match-engine balance tests and exhibition draws do not establish official competition rules.

## Availability and discipline

Exhibitions retain the approved reset of fatigue and injuries. Official persistence needs an explicit decision on injury durations, availability, recovery cadence and sanction carryover. No probabilities or durations have been guessed in this increment. Adding eligible-player availability must use a versioned adapter/engine change while preserving v0.1 replay support.

Detailed bench misconduct, retaliation, offset fouls, dissent and escalation remain documented gameplay-rule extensions. Define what 1.0 must generate automatically and what, if anything, is commissioner administration. Do not infer sanctions from the current aggregate foul category.

## User workflow and 1.0 acceptance

Build the commissioner workflow around choosing a competition/round, reviewing the pinned fixtures/availability, simulating, reviewing a proposed result, accepting it once, and viewing updated tables, box scores and matchday briefing exports. Keep exhibition and competitive records visibly distinguished.

1.0 is ready when a complete representative competition can be initialized from canonical database rosters, simulated and committed safely, resumed after interruptions, audited/replayed, and summarized through the intended user workflow. Confirm policy choices and validate result persistence/permissions before activating the inaugural competition. Additional broad Monte Carlo balance sweeps are not a prerequisite unless a specific gameplay defect is found.
