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

The CenturyLeague database has 900 active men's players, 18 teams, 18 original coaches and 630 assigned players, exactly 35 per team. The remaining 270 players are unassigned. Men's Season 1 points to the November 2026 Inaugural Tournament and remains in setup; the women's league is planned and uninitialized. Competition/result tables now support explicitly separate exhibitions; official competitive activation remains deferred.

The canonical import completed atomically, preserving all current player abilities, existing snapshot fields other than the initially empty team assignment, private development metadata and original coach profiles/preferences. It recorded draft history, 18 public match-team season snapshots and an audit receipt. Exact retry returned the same receipt without additional writes. See [the import record and backend contract](FOUNDING_ROSTER_IMPORT.md).

## Implemented: authoritative exhibition acceptance and commissioner surface

The additive database migration, backend-only transactional RPCs and authenticated `manage-matches` endpoint are deployed. Definitions, canonical season-roster links, immutable fixture inputs, generated proposals, insert-once accepted registrations and audit records are persisted. Compact security-invoker views derive fixture status and unranked exhibition records from accepted results. Exact retries do not increment records twice; stale different-fixture writes require a refreshed revision.

The Match Center is implemented in the registry and published through PR #2: explicit exhibition creation, activation, simulation, proposal review, acceptance, saved-result reopening, replay verification, box scores and accepted-only round briefing exports. Its backend computes proposals from pinned inputs and derives the commissioner identity from a verified session. Browser roles cannot send result ledgers or call write RPCs. See [database workflow and validation](MATCH_WORKFLOW_DATABASE.md).

Local exhibition database/service tests pass 103 checks, including technical-abort and interrupted-reply recovery; PostgreSQL CI passes 110. CI additionally exercises independent-session contention and rollback with a disposable PostgreSQL service. Nine additional Chromium checks cover the desktop/mobile surface with mocked API responses. The live permission probe rolled back without leaving competition/match records. The accepted gameplay source/default fingerprint is unchanged.

## Remaining integration and release checks

- Signed-in live acceptance is verified: the deployed UI created, activated, simulated, accepted, replayed, exported and reopened a complete exhibition after reload. Its one accepted result and one acceptance audit record remained unchanged after an exact retry. See [the live verification record](LIVE_EXHIBITION_VERIFICATION_2026_11_01.md).
- Completed: [versioned replay portability](REPLAY_PORTABILITY_V1.md) distinguishes exact replay from tightly bounded lateral coordinate rounding, retaining exact match facts and unchanged historical payloads.
- The commissioner approved [availability, discipline, correction and technical-restart policy v1](COMPETITION_POLICY_V1.md) on November 1, 2026. Implement and validate those policies while preserving v0.1 replay support. Competitive creation remains gated on implementation/readiness and the eventual format.
- Completed: [four-team, two-round live exhibition](FOUR_TEAM_VALIDATION_2026_11_01.md) verified cumulative records, unfinished rounds, recovery and accepted-only exports.
- Implemented and tested: [competitive operations candidate](COMPETITIVE_OPERATIONS_CANDIDATE.md), including a versioned eligibility adapter, calendar recovery, commissioner discipline decisions, suspension service, void/replacement projections, later-match review and a durable private validation journal with immutable source proposals. Its migration is not applied live, and official acceptance/UI integration and policy calibration remain required.
- Confirm database result persistence/authorization and commissioner workflow acceptance before declaring 1.0. The portable local rehearsal adapter remains useful for offline tests, but is not a second authoritative live store.

## Competition policy and scheduling

The commissioner has deferred the inaugural format until the rest of the engine is ready. Continue database acceptance and workflow implementation using explicit disposable test fixtures. Format selection is not a blocker for that work. Before official fixtures are generated, confirm the format for the current 18 teams and define standings points, tie-breaks and knockout/series advancement where relevant. Commissioner correction authority and the default technical-restart policy are approved; formal forfeits remain deferred unless needed. The new core accepts an explicit fixture list and does not assume a tournament structure or import an older entrant count.

Later monthly scheduling must preserve the independently agreed competition structure and rest constraints when those are supplied as current scheduling policy. Match-engine balance tests and exhibition draws do not establish official competition rules.

## Availability and discipline

Fatigue remains within-match, and exhibition injuries reset. The approved competitive policy carries injuries forward, uses calendar-day recovery across monthly seasons and initially requires full recovery for eligibility. Most absences should be short, with occasional longer injuries; quantitative distributions remain calibration work. Adding eligible-player availability must use a versioned adapter/engine change while preserving v0.1 replay support.

Serious/repeated misconduct may receive a suspension under an approved offense table; ambiguous incidents go to the commissioner. Bans follow players across transfers and monthly seasons, with eligible official matches counting toward service. Exhibitions neither enforce nor serve them. Detailed incident generation and the sanction table still require implementation/validation; do not infer unrecorded misconduct from aggregate fouls. See [policy v1](COMPETITION_POLICY_V1.md) for correction authority, finality and technical abort handling.

## User workflow and 1.0 acceptance

Build the commissioner workflow around choosing a competition/round, reviewing the pinned fixtures/availability, simulating, reviewing a proposed result, accepting it once, and viewing updated tables, box scores and matchday briefing exports. Keep exhibition and competitive records visibly distinguished.

1.0 is ready when a complete representative competition can be initialized from canonical database rosters, simulated and committed safely, resumed after interruptions, audited/replayed, and summarized through the intended user workflow. Confirm policy choices and validate result persistence/permissions before activating the inaugural competition. Additional broad Monte Carlo balance sweeps are not a prerequisite unless a specific gameplay defect is found.
