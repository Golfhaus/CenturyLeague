# Database match workflow

This increment adds authoritative exhibition persistence and a commissioner Match Center around the frozen `0.1.0-exhibition` gameplay core. The inaugural tournament format remains deferred until the rest of the engine is ready. No official competition, fixture or result has been created.

## Commissioner workflow

The Match Center is an additional tab in the existing player registry. A commissioner selects a season, names an exhibition, and adds explicit team pairings and rounds from imported season rosters. Saving creates a draft; activation pins those fixtures and allows simulation. No automatic inaugural draw or ranking policy is assumed.

Simulating creates a durable proposal from the backend's frozen database input. Review shows final/quarter scores, event-derived team statistics, all 70 player box scores, the winning kick and recorded incidents. Acceptance updates the exhibition's record table once. A saved proposal can be reopened after a page reload without resimulating. Viewers can inspect, export and verify results, but cannot create, activate, simulate or accept.

Match exports identify proposed versus accepted results. Round briefing exports include only accepted matches, their event references and a count of pending fixtures. They contain enough recorded facts for matchday summaries; no model call is part of the simulation or export. Fatigue and injuries still reset after each exhibition.

## Backend and transaction boundary

The applied migration is `20261101185535_competition_result_acceptance.sql`. The `manage-matches` Edge Function uses gateway JWT verification and verifies the bearer with `Auth.getUser`, then reads authorization from `app_users`. It does not use user-editable metadata or a caller-supplied actor. Service credentials stay in the backend.

Write RPCs are security invoker, executable only by `service_role`, and recheck the derived actor's current commissioner role:

- `create_exhibition_competition_v1`: validates season/category/source identity, resolves canonical public rosters, creates immutable fixture inputs and an audit record atomically. A repeated identical definition returns the existing competition; changes conflict.
- `activate_competition_v1`: locks the competition and requires the current draft revision. Exact activation retry is harmless.
- `stage_match_proposal_v1`: accepts only the trusted backend's generated ledger. It checks pinned inputs, scope, completion and basic scoring invariants, computes its digest and stores it once. Browser callers cannot provide a ledger through the Edge API. The TypeScript backend performs full statistic validation on the generated result; the SQL function does not independently reimplement the simulation.
- `accept_match_proposal_v1`: takes a proposal ID and expected revision, locks the competition, registers the immutable proposal once, increments the revision, determines completion and appends audit data in one transaction. An exact retry succeeds without another increment even with its original stale revision; another pending fixture needs the current revision.

Proposal generation happens before the acceptance transaction. SQL acceptance does not download or replay an entire season ledger. Compact security-invoker views expose fixture status and records derived from accepted results only. There are no mutable standing counters or browser write grants. A separate replay action validates the saved event/statistic ledger against the frozen engine.

Accepted payloads are immutable; corrections, voids, forfeits and administrative scores require a future explicit audited policy/API. Official competitive creation is intentionally unavailable while tournament and availability/discipline decisions remain open. Registered-user read access follows the existing single-universe registry access model.

## Verification and reproducibility

```bash
npm run validate:competition-db
npm run validate:competition
npm run verify:match-baseline
npm run typecheck
npm run build:registry
```

The default database harness applies the actual migration to disposable PostgreSQL/WASM with synthetic players and exercises the actual Edge service through a PostgREST-shaped adapter. Its 61 checks cover canonical snapshot enforcement, scope/format gates, atomic failures, retry/conflict behavior, role restrictions, ledger immutability, score/record reconciliation, full replay, verified actor propagation, forged-body exclusion, accepted-only briefing exports and rollback.

CI supplies a disposable PostgreSQL 17 service via `COMPETITION_TEST_DATABASE_URL` and adds two independent connections. All 68 PostgreSQL checks passed in CI. The independent-session tests cover an accepted transaction rolled back before commit, simultaneous different-fixture acceptance at the same revision, the losing request's stale-revision response and retry, simultaneous exact retries, and absence of duplicate acceptance/audit increments. The harness refuses remote database hosts and is intended only for an empty disposable test database. The local WASM fallback has one connection and does not claim to test concurrent sessions.

The Edge deployment passes Deno type checking. `scripts/sync-match-edge.mjs --check` verifies its source mirror; `npm run sync:match-edge` regenerates it from the shared core. The gameplay baseline guard remains unchanged. New database types are regenerated from the live schema.

A rolled-back live probe verified canonical creation, creation retry, activation and lack of browser execution/write privileges. After rollback, live competition/proposal/result counts remained zero and the 630 player assignments and 18 imported roster snapshots remained intact. Live HTTP calls without a valid session returned 401; direct anonymous acceptance RPC calls returned permission denied. Security advisors reported no new security findings. New unused-index informational notices are expected before matches exist; foreign-key indexes are retained.

A Chromium smoke test passed nine desktop/mobile checks with mocked API responses: activation, simulation/review, one acceptance, replay action, briefing download, viewer restrictions, no horizontal page overflow and no uncaught page errors. This complements the actual-service/database tests; a signed-in live browser acceptance remains a release check. Stable selector labels and grid minimum widths were corrected during this pass.

The frontend was published on November 1, 2026 through merged PR #2 (merge commit `44bd25033d4e5f4a7d8ad300ef014827528b63f7`). Production CI and the GitHub Pages build/deployment passed. The backend schema and authenticated Edge endpoint are deployed. The public application loads its commissioner sign-in screen; a sign-in link was requested through the secure browser flow. Signed-in exhibition creation, acceptance, reopening and briefing export against the live endpoint remain pending completion of that authentication. This is progress toward 1.0, not an official competition activation or a declaration that the entire release is complete.
