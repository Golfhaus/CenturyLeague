# Competition/result foundation v0.2

This is the first implementation milestone toward a 1.0 match-simulation workflow. It wraps the accepted v0.1 gameplay core; no v0.1 gameplay files, coefficients, default settings or replay identities change.

The portable TypeScript module is `packages/simulation-core/src/competition`. The Node CLI and file store are an isolated rehearsal adapter. Supabase/PostgreSQL is authoritative for live rosters; the [database-backed exhibition adapter and commissioner surface](MATCH_WORKFLOW_DATABASE.md) are now implemented. The separate founding-roster migration and canonical import are complete. No official fixtures have been created and historical exhibitions remain exhibitions.

## Competition lifecycle

Definitions pin competition ID, men's/women's category, monthly season key, exhibition/competitive classification, engine version/fingerprint, public rosters/coaches, match configuration and an explicit fixture list. Each fixture pins its ID, round, seed and ordered pair of teams. The validator rejects duplicate players/teams/fixtures, invalid rosters or attributes, unknown teams, and a team appearing twice in one round. There is no automatic inaugural draw or assumed tournament structure.

A canonical definition snapshot detects accidental edits after creation, including changes to rules or ranking policy. Like the store checksum, this is an integrity check rather than protection against an authorized writer deliberately replacing both values.

The state transitions are:

1. Draft at revision 0: definition validated, no results accepted.
2. Active at revision 1: fixtures can be simulated and results proposed.
3. Each accepted result advances the revision exactly once.
4. Complete after every declared fixture has an accepted result.

The simulation operation is separate from acceptance. A result proposal does not update the table. The accepted record retains the full input, rules, event ledger, player/team statistics, accepting actor and acceptance timestamp.

## Acceptance guarantees

New results must match the frozen fixture ID, seed, team order, all player attributes and coach preferences, adopted gameplay fingerprint and rules configuration. Competitive results must also carry the matching competition ID, category, season and competitive classification. Standalone exhibitions lack that competitive provenance and cannot be casually accepted as competitive results.

Validation requires legal capped final scores, exactly four ordered quarters, the qualifying last winning kick, all 70 roster box scores, credited player/team statistic reconciliation, player-time reconciliation and full deterministic event/statistic replay. A failed proposal leaves the prior state intact.

An identical result retry is a no-op, including when its expected revision predates the successful acceptance. A different result for the same fixture is rejected. New results require the exact current revision. No overwrite, correction, void, forfeit or administrative score entry is implemented. [Commissioner policy v1](COMPETITION_POLICY_V1.md) approves audited corrections and default restarts for technical aborts; implementing the corresponding APIs remains required before use. Formal forfeits stay deferred unless needed.

These functions validate data and workflow, not authorization. Actor labels are audit metadata, not proof of identity. The database adapter derives its actor from a verified session, enforces commissioner/service permissions and commits atomically in PostgreSQL. The local rehearsal actor label remains only metadata. A client-supplied digest or actor cannot grant authority.

## Standings policy

The table derives played, wins, losses, points for/against, difference and win percentage solely from accepted results. No default league scoring or tie-break policy is adopted. Without `standingsPolicy`, table points and rank are null, and rows retain roster order.

An explicit policy supplies nonnegative integer win/loss table points and an ordered subset of `tablePoints`, `wins`, `winPercentage`, `pointDifference`, `pointsFor`. Exact ties remain tied even if names determine display order. Head-to-head and playoff tie resolution are not implemented or silently approximated. Unit-test point allocations are examples, not Century league policy.

## Rehearsal persistence

`scripts/lib/competition-store.mjs` stores a checksummed envelope explicitly marked `local-rehearsal`. A worker holds a nonblocking exclusive operating-system `flock`, validates the expected revision, writes a private temporary file, fsyncs, atomically renames and fsyncs the parent directory. Exact retries do not rewrite the file. A busy store rejects a write. The kernel releases the lock when its writer exits, including an abrupt exit. The empty `.writer-lock` file is persistent coordination state: do not unlink it or infer that its presence means a lock is held. All mutation callers must use this adapter; the internal worker entry is not a public API.

The checksum detects accidental corruption, not malicious editing. The adapter requires Linux/util-linux `flock` and one local host/filesystem with advisory-lock support (as in Codespaces and Linux CI). It is not a distributed/multi-host lock, a second authoritative live store or a production authorization system. A missing lock utility fails closed; it does not fall back to an unsafe write. The separate database adapter uses per-fixture unique constraints and transactional revision/row locking, without loading the entire season ledger for acceptance.

## Commands

```bash
npm run validate:competition
npm run competition -- init --definition /private/definition.json --store /private/rehearsal.json
npm run competition -- activate --store /private/rehearsal.json --expected-revision 0
npm run competition -- simulate --store /private/rehearsal.json --fixture fixture-01 --output /private/proposed-result.json
npm run competition -- accept --store /private/rehearsal.json --result /private/proposed-result.json --actor local-commissioner --expected-revision 1
npm run competition -- table --store /private/rehearsal.json
npm run competition -- verify --store /private/rehearsal.json
```

To rehearse the nine existing all-club exhibitions, keeping their exhibition classification:

```bash
npm run rehearse:competition -- --round-directory /private/exhibition-round-01 --store /private/exhibition-rehearsal.json --season 2026-11
```

It accepts nine stored results, retries each, replays all nine and checks one appearance per team. Re-running it accepts zero additional results. It creates no live database records and does not alter the source exhibitions.

## Draft-import proposal

```bash
npm run prepare:draft-import -- --players /private/canonical_players.json --draft /private/Century_Draft_State_After_Round_35.json --coaches /private/century_founding_coaches.json --output /private/draft-import-proposal.json
```

This validates the completed canonical draft, strips hidden development fields and prepares 18 public rosters/original coach profiles and 630 proposed assignments. It writes a proposal only and refuses to overwrite an existing output.

The separate backend-only `import_founding_rosters_v1` now resolves team UUIDs, validates the full founding population and existing season snapshots, checks eligible/category/unassigned players, and commits teams, coaches, assignments, history and pinned public season rosters atomically. Its canonical live import completed on November 1, 2026: 18 teams, 18 original coaches, 630 assigned players and 270 free agents. See [request preparation, access controls and verification](FOUNDING_ROSTER_IMPORT.md). The inaugural format remains deferred until other engine work is ready.

## Validation evidence

The validator passes 85 checks covering lifecycle gates, frozen definitions, malformed fixtures, unsupported engine identity, roster/config/seed tampering, falsified score/quarter/player/time/ledger data, competitive cross-season/category/competition/classification contamination, exact retries, conflicting results, revisions, completion, unranked and explicit-policy tables, ties, corrupted store checksums, concurrent independent writers and automatic kernel-lock release after an abrupt holder exit.

The real nine-match exhibition round completed the acceptance rehearsal: nine accepted records, nine immediate no-op retries, all nine exact replays, 18 teams with one appearance each and no ranking policy invented. A repeated rehearsal run also accepted zero additional results. Type checks, the edge mirror check and the adopted v0.1 source/default guard pass. Rehearsal results remain separate from official data; no live match results have been written. The roster-request validator adds 20 checks, and the backend importer was exercised with rolled-back failure/retry tests before its live import.
