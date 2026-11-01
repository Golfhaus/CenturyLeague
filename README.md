# CenturyLeague

CenturyLeague is the simulation platform for the sport of Century.

The repository is organized as a monorepo so player generation, lifecycle development, league management, and match simulation share one authoritative player model.

## Applications and packages

- `apps/player-registry` — player creation, population browsing, lifecycle advancement, exports, retirements, and roster assignment.
- `apps/match-simulator` — exhibition simulation entry point consuming the same player records; the event engine lives in the shared core.
- `packages/simulation-core` — shared player attributes, archetypes, generation logic, development logic, and role calculations.
- `supabase` — database migrations and backend functions.
- `docs` — model and architecture specifications.

## Commissioner principle

The commissioner may configure universe-wide generation and development rules, but may not manually edit an individual player's abilities. Player ratings are generated and subsequently changed only by the simulation engine.

## Status

The shared player generator and lifecycle models are implemented. Match Engine v0.1 is the adopted permanent simulation baseline as of November 1, 2026. It supports fluid player deployment, all 35 eligible players, fatigue and authorized interchanges, score-triggered quarters, bonuses, a qualifying central kick to finish at exactly 100, event-derived team/player box scores and podcast briefing data.

Run `npm run verify:match-baseline` to verify the adopted source and defaults, `npm run validate:matches` for scoring/match checks, or `npm run simulate:round -- --players /private/players.json --draft /private/draft.json --coaches /private/coaches.json --round-id exhibition-round-02 --output /private/round-02` for a nine-match round covering all 18 clubs once. These commands require dependencies installed with `npm install`.

See [the release decision and scope](docs/MATCH_ENGINE_V0_RELEASE.md) and [the engine model and CLI instructions](docs/MATCH_ENGINE_V0.md). The tested engine identity remains `0.1.0-exhibition` to preserve random-seed and saved-match compatibility. The core does not commit official standings or carry player injuries into future matches.

The next implementation milestone is the [v0.2 competition/result foundation](docs/COMPETITION_RESULTS_V0_2.md), with validated acceptance, exact retry safety, tables and an isolated local rehearsal CLI. It does not write live database results or adopt a standings policy. See the [1.0 roadmap and live-data prerequisites](docs/MATCH_ENGINE_1_0_ROADMAP.md).

The [canonical founding-roster import](docs/FOUNDING_ROSTER_IMPORT.md) is complete: 18 men's teams, 18 original coaches, 630 rostered players and 270 free agents, with player abilities preserved. The inaugural tournament format is deferred until the remaining engine work is ready.


## Season and player-pool cadence

Century runs one season per calendar month, beginning with the November 2026 Inaugural Tournament.

Player entry windows occur after the March, June, September, and December seasons. Unsigned-player attrition is evaluated at those same quarterly checkpoints using the versioned player-pool lifecycle model. The inaugural population is treated as the Founding Player Pool rather than a normal entry class.


## Independent men's and women's leagues

The men's and women's Century leagues are separate competition universes. They maintain independent season numbers, current-season state, player populations, entry windows, development runs, roster pools, and founding classes.

The men's league launches first with Season 1 in November 2026 and a planned 900-player Founding Player Pool. The women's league is currently marked planned and has no initialized season or player population; it will be started later with its own Season 1 and founding pool.
