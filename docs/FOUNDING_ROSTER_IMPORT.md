# Founding roster import

The canonical men's Season 1 import completed on November 1, 2026. It created 18 teams and 18 original coaches, assigned 630 players at 35 per team, and left 270 active free agents. The season remains in setup. The women's league remains planned. No official fixtures, results or standings were created; the inaugural tournament format is deferred until the rest of the engine is ready.

The transaction recorded 630 draft-history entries, completed the initially empty team assignment in 630 existing season snapshots, and pinned 18 public match-team season snapshots. The full original coach profiles and ten tactical preferences were preserved. Current player ratings, all other existing snapshot fields and private development metadata were unchanged.

Audit receipt: `1f8cdb60-3aca-4037-a5d6-6b380804c95d`.

## Backend contract

The additive migrations are `20261101182939_founding_roster_import.sql` and `20261101183504_roster_import_backend_policy.sql`. Generated database types include their public tables and RPC contract.

`public.import_founding_rosters_v1` is a security-invoker function executable only by `service_role`. It uses a transaction-scoped advisory lock and row locks, validates the current initial setup season, all 900 public player identities/abilities, matching season snapshots, 18 unique teams/coaches and 630 eligible unassigned draft UUIDs. It creates real database team UUIDs and never treats display names as UUIDs.

Each season/category has one import receipt. An exact retry returns that receipt with `applied: false`; changed source hashes, population fingerprint or payload are rejected. The importer is only for the initial founding setup, not later transfers or roster replacement. Public new tables are readable by registered app users with RLS; only the backend writes. The archived input payload is private and has an explicit backend-only policy.

Prepare a credential-free request from the original source files:

```bash
npm run prepare:roster-import -- --players /private/canonical_players.json --draft /private/Century_Draft_State_After_Round_35.json --coaches /private/century_founding_coaches.json --season-id <database-season-uuid> --output /private/founding-roster-request.json
```

The preparer writes a new private file and refuses to overwrite an existing path. It performs no database writes. Send only its `arguments` object to the RPC through an authorized backend connection. Keep credentials, raw canonical player exports and generated requests outside the repository. The request includes only draft player UUIDs and original coach profiles, plus source/population hashes; private player fields are excluded.

## Verification

`npm run validate:roster-import` passes 20 checks for canonical counts, profiles, draft order, deterministic fingerprints, population-order independence, changed free-agent abilities, invalid identities/attributes, duplicates and private-field exclusion.

Before committing live data, a rolled-back service-role transaction verified rejection of altered population hashes and duplicate player UUIDs, a successful import, exact retry, rejection of modified coaching input, and browser-role execution denial. The live import then committed successfully; an exact retry returned the same receipt without duplicating records.

Post-import verification found zero draft-order, player/name/rating, or coach/profile/preference mismatches. The full public population fingerprint was `bbac72edb074832b103f637a48519b80d1f64a6ad3b0cc92446fa7b162cd6499`. Aggregate before/after hashes also matched for all current rating records, all existing snapshot fields except team assignment, and private player metadata. No private values were exported for that check. Security review found no new advisor findings from these migrations.
