# Inaugural tournament integration

The November 2026 inaugural uses the approved 18-team double-elimination draw, seeded by the full-league 7,650-game exhibition study. The canonical specification is [inaugural-tournament-v1.json](inaugural-tournament-v1.json). Match numbers M01–M39 match the published bracket. There are 38 guaranteed official games, including four division placement games, and one conditional grand-final reset. Byes create no fixtures, wins, statistics or suspension service.

All starts are 19:00 America/New_York: November 3, 6, 10, 13, 17, 20, 24, 27; December 1; December 4 only if the lower finalist wins M38. The subsequent divisional program reserves December 8–27, independent of reset necessity. Venue names, crowds and fictional quotes are not supplied by the engine.

## Event span and rosters

The inaugural remains one competition anchored to its November entry season. Its explicitly approved event span permits December 1/4 fixtures without creating a second competition or resetting availability. November public roster/coach snapshots for all 18 clubs are frozen in the event definition. The category availability journal remains authoritative across this tournament, subsequent competitions, months and transfers. Normal competitions retain their monthly date boundary. This does not decide December transfer or roster-update policy; the December divisional program will use its own canonical season inputs when registered.

## Registration and progression

`official-register-inaugural` takes only a competition ID and November season ID. The backend loads the fixed format, exhibition seed order and all 18 canonical entry rosters; it creates a draft with eight known opening fixtures and 39 immutable bracket slots. A unique index prevents a second copy of this inaugural. Retrying the same registration retains its identity. Browser-supplied routing, scoring, seed assignments and rosters cannot alter the format.

`official-detail` includes all slots, dates, feeder references, resolved team IDs and conditional status. `official-advance` prepares newly resolved fixtures from active accepted leaf results only, under the category journal lock and expected revision. It can be retried without duplicating fixtures and never simulates or accepts results. Placement pools rank the four eligible clubs by original seed, pairing best/worst and the middle two. Full division allocation is exposed after completion; placement losses are separate from title-elimination losses.

Corrections preserve immutable proposals and result history. Voided or superseded results cannot feed a new fixture. If a correction invalidates a prepared matchup, simulation and acceptance guards reject it until the commissioner explicitly corrects/replaces the affected fixture. Existing downstream review requirements remain in force. Tournament closure also checks unresolved future slots, including the conditional reset, rather than only currently materialized fixtures.

## Execution boundary

Format approval permits draft preparation while activation remains disabled. Active simulations and sporting journal writes still require the policy, format and activation gates. Scheduled-time guards apply to first pins and accepted events, including direct backend RPCs; the official simulation adapter also checks current routing before recovering a prior proposal. No scheduler, job credentials, unattended acceptance, notification delivery, automatic discipline or recurring automation is installed by this integration.

`npm run validate:inaugural` runs 2,000 independent structural draws plus an end-to-end tournament through the actual official service/database workflow in an isolated database. Tests cover both final paths structurally, all seed routes, rest gaps, pool ranking, unique divisions, frozen inputs, scheduled-time/activation checks, duplicate retries, replay, exports, closure, corrections and browser-role rejection. PostgreSQL uses a fresh disposable database separate from the other suites. Its test clock is changed only in that database to exercise the full calendar without waiting for future dates. Production due-time checks are retained.

The gameplay engine and availability adapter fingerprints are unchanged. The next stage is a separately authenticated scheduled runner, with due-fixture selection, idempotent retries, commissioner-review pauses and manual recovery. Enable official activation only as part of that controlled launch.
