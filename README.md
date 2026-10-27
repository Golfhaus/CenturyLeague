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
