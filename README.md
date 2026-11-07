# CenturyLeague

CenturyLeague is the simulation platform for the sport of Century.

The repository is organized as a monorepo so player generation, lifecycle development, league management, and match simulation share one authoritative player model.

## Applications and packages

- `apps/player-registry` — player creation, population browsing, lifecycle advancement, exports, retirements, and roster assignment.
- `apps/match-simulator` — exhibition simulation entry point consuming the same player records; the event engine lives in the shared core. The registry's Match Center also provides the database-backed exhibition, rehearsal and official competition workflows.
- `packages/simulation-core` — shared player attributes, archetypes, generation logic, development logic, and role calculations.
- `supabase` — database migrations and backend functions.
- `docs` — model and architecture specifications.

## Commissioner principle

The commissioner may configure universe-wide generation and development rules, but may not manually edit an individual player's abilities. Player ratings are generated and subsequently changed only by the simulation engine.

## Status

The shared player generator and lifecycle models are implemented. Match Engine v0.1 is the adopted permanent simulation baseline as of November 1, 2026. It supports fluid player deployment, all 35 eligible players, fatigue and authorized interchanges, score-triggered quarters, bonuses, a qualifying central kick to finish at exactly 100, event-derived team/player box scores and podcast briefing data.

Run `npm run verify:match-baseline` to verify the adopted source and defaults, `npm run validate:matches` for scoring/match checks, or `npm run simulate:round -- --players /private/players.json --draft /private/draft.json --coaches /private/coaches.json --round-id exhibition-round-02 --output /private/round-02` for a nine-match round covering all 18 clubs once. These commands require dependencies installed with `npm install`.

See [the release decision and scope](docs/MATCH_ENGINE_V0_RELEASE.md) and [the engine model and CLI instructions](docs/MATCH_ENGINE_V0.md). The tested engine identity remains `0.1.0-exhibition` to preserve random-seed and saved-match compatibility. The core does not commit official standings or carry player injuries into future matches.

The [v0.2 competition/result foundation](docs/COMPETITION_RESULTS_V0_2.md) includes validated acceptance, exact retry safety, tables and an isolated local rehearsal CLI. The [database-backed exhibition workflow](docs/MATCH_WORKFLOW_DATABASE.md) and Match Center were published on November 1, 2026. The [official category registry](docs/OFFICIAL_REGISTRY_READINESS.md#authoritative-integration) connects official result acceptance to persistent availability journals, corrections and accepted-only records. The approved inaugural format and its scheduled runner are implemented; the men's competition was verified active on November 3, 2026, as detailed below.

The [canonical founding-roster import](docs/FOUNDING_ROSTER_IMPORT.md) is complete: 18 men's teams, 18 original coaches, 630 rostered players and 270 free agents, with player abilities preserved.

The [1.0 roadmap](docs/MATCH_ENGINE_1_0_ROADMAP.md), earlier readiness records and the execution-boundary notes in the tournament integration document retain their historical development stages. Their deferred-format, disabled-activation and next-stage-runner statements describe those earlier stages; use the tournament specification, scheduled runner documentation and dated evidence below for the implemented inaugural and its verified launch. Workflow implementation and activation do not change the frozen gameplay identity or establish subsequent match completion.

## Inaugural tournament

The [approved tournament integration](docs/INAUGURAL_TOURNAMENT_V1.md) implements the 18-team double-elimination inaugural, seeded by the full-league 7,650-game exhibition study. The [canonical bracket specification](docs/inaugural-tournament-v1.json) defines seeds, dated slots and winner/loser feeder routes for M01–M39: 38 guaranteed official games, including four division placement games, plus one conditional grand-final reset. Byes create no fixtures, wins or statistics.

All scheduled windows open at **19:00 America/New_York**: November 3, 6, 10, 13, 17, 20, 24 and 27, then December 1, 2026. M38 is the December 1 grand final; M39 runs on December 4 only if the lower finalist wins M38. November entry rosters and coaches remain frozen throughout the event, whose approved span crosses the monthly boundary. December divisional play has a reserved December 8–27 window; those fixtures still require generation from the inaugural's division allocations and separate scheduling.

Registration creates a draft with 39 immutable bracket slots and eight known opening fixtures. Advancement resolves later fixtures only from active accepted feeder results, with retry and correction guards. See [registration and progression](docs/INAUGURAL_TOURNAMENT_V1.md#registration-and-progression) for placement pools, division allocation, downstream corrections and closure checks.

### Verified launch and evidence limits

| Record | What it establishes |
| --- | --- |
| [November 3 launch verification](docs/verification/scheduled-runner-launch-2026-11-03.json), recorded by [commit 27eea3e](https://github.com/Golfhaus/CenturyLeague/commit/27eea3ee9c0ff510c5da79d0555e38d8ac53d5ea) | At `2026-11-03T14:44:15Z`, the men's competition was active, the runner enabled, and the every-minute `century-inaugural-runner-v1` clock installed and checked successfully before the first due window. The women's release remained disabled. |
| Official results in that launch record | **Zero accepted official results at that time.** The clock check established activation and scheduling, not completion of a match. |
| [November 4 API handoff repair](https://github.com/Golfhaus/CenturyLeague/commit/232af9c1fd5088875d22972eb6c871adcfe36098) | Source explicitly filters all six control-row updates with `where singleton = true` for API sessions using `safeupdate`, adds sanitized failure diagnostics and regression checks, and requires complete live execution verification after deployment. |

These repository records do not establish the number of subsequently accepted official results or prove that every later execution issue is resolved. Live verification must observe **scheduler → endpoint → claim → accepted-result → finish** after deployment. Cron success alone is insufficient; matchday completion requires accepted official results. See the [API handoff repair and verification requirements](docs/SCHEDULED_OFFICIAL_RUNNER_V1.md#api-handoff-repair--november-4-2026).

### Scheduled execution and recovery

The [scheduled official runner](docs/SCHEDULED_OFFICIAL_RUNNER_V1.md) uses database Cron to check every minute and dispatch due fixtures to the separately authenticated `run-official-fixture` endpoint. Each worker handles one match through the official pin/proposal/acceptance workflow; completion can dispatch the next due match immediately. Results appear progressively after a window opens. No LLM simulates matches.

- [Authority and access safeguards](docs/SCHEDULED_OFFICIAL_RUNNER_V1.md#scope-and-authority): a Vault-held dedicated credential, pinned competition/actor/endpoint, backend-only queue RPCs and no browser access to private control, jobs or audit records. The commissioner endpoint retains JWT verification.
- [Execution and retries](docs/SCHEDULED_OFFICIAL_RUNNER_V1.md#execution-and-retries): a single 180-second lease, fenced sporting writes and a stable acceptance command ID per fixture. Retries recover saved proposals/results and retain pinned inputs and seeds; transport/lease failures have a three-attempt limit before manual recovery.
- [Commissioner recovery and corrections](docs/COMPETITION_POLICY_V1.md#technical-aborts-and-restarts): check for saved work before restarting; technical failures do not create scores or automatic forfeits. Sporting exceptions and serious/repeated incident or correction reviews require commissioner handling. Match Center's **Automatic match execution** controls provide status, pause/resume and reasoned retry without overwriting accepted results or bypassing review.
- [Failure monitoring](docs/SCHEDULED_OFFICIAL_RUNNER_V1.md#api-handoff-repair--november-4-2026): inspect dispatch/claim handoff failures, repeated unsuccessful HTTP responses and due queued jobs without a claim, even when no failed job row exists. Diagnostics expose fixed stages and validated error codes, never raw exceptions, credentials, request bodies or match ledgers.

For implementation checks, run `npm run validate:inaugural` and `npm run validate:scheduled-runner` after `npm install`. These use isolated databases and test clocks; they do not establish live match completion. See [runner installation and launch](docs/SCHEDULED_OFFICIAL_RUNNER_V1.md#installation-and-launch) for permissions, separate live-clock verification and automatic clock removal after all required games are accepted, including the reset only when needed.


## Season and player-pool cadence

Century runs one season per calendar month, beginning with the November 2026 Inaugural Tournament. The inaugural's approved event span includes its December 1 final and conditional December 4 reset within the same competition, with frozen November entry rosters and continuing category availability.

Player entry windows occur after the March, June, September, and December seasons. Unsigned-player attrition is evaluated at those same quarterly checkpoints using the versioned player-pool lifecycle model. The inaugural population is treated as the Founding Player Pool rather than a normal entry class.


## Independent men's and women's leagues

The men's and women's Century leagues are separate competition universes. They maintain independent season numbers, current-season state, player populations, entry windows, development runs, roster pools, and founding classes.

The men's league's November 2026 Season 1 has an imported 900-player Founding Player Pool; its inaugural competition was verified active at the November 3 launch. The women's league remains planned and uninitialized, with its release disabled in that launch record; it will start later with its own Season 1 and founding pool.
