# CenturyLeague

CenturyLeague is the simulation platform for the sport of Century.

The repository is organized as a monorepo so player generation, lifecycle development, league management, and the future match simulator share one authoritative player model.

## Planned applications

- `apps/player-registry` — player creation, population browsing, lifecycle advancement, exports, retirements, and roster assignment.
- `apps/match-simulator` — future Century match simulation consuming the same player records.
- `packages/simulation-core` — shared player attributes, archetypes, generation logic, development logic, and role calculations.
- `supabase` — database migrations and backend functions.
- `docs` — model and architecture specifications.

## Commissioner principle

The commissioner may configure universe-wide generation and development rules, but may not manually edit an individual player's abilities. Player ratings are generated and subsequently changed only by the simulation engine.

## Status

Initial architecture and Player Generator v1.0 specification are being implemented.


## Season and player-pool cadence

Century runs one season per calendar month, beginning with the November 2026 Inaugural Tournament.

Player entry windows occur after the March, June, September, and December seasons. Unsigned-player attrition is evaluated at those same quarterly checkpoints using the versioned player-pool lifecycle model. The inaugural population is treated as the Founding Player Pool rather than a normal entry class.


## Independent men's and women's leagues

The men's and women's Century leagues are separate competition universes. They maintain independent season numbers, current-season state, player populations, entry windows, development runs, roster pools, and founding classes.

The men's league launches first with Season 1 in November 2026 and a planned 900-player Founding Player Pool. The women's league is currently marked planned and has no initialized season or player population; it will be started later with its own Season 1 and founding pool.
