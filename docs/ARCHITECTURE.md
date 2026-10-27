# CenturyLeague Architecture

## Goals

CenturyLeague will ultimately contain several applications that share one player database and one simulation model.

### Player Registry

Responsible for:

- generating one player or populations in bulk
- viewing and filtering players
- exporting population data
- assigning players to teams
- preserving season-by-season ratings
- advancing careers after each monthly season
- processing retirements

### League Manager

Future responsibilities:

- teams and rosters
- transactions and drafts
- competitions and schedules
- standings and season state

### Match Simulator

Future responsibilities:

- match state and possessions
- contests for possession
- kicking, hand-passing, carrying and bouncing
- aerial contests
- tackling and loose balls
- fatigue and substitutions
- scoring and match statistics

## Shared simulation core

All applications must use `packages/simulation-core` for attribute names, role calculations, player-generation rules, and career-development rules.

No application may maintain a separate copy of player ratings.

## Database authority

Supabase/PostgreSQL is the authoritative persistent store.

Current ratings are stored as continuous values. The normal UI displays rounded 1–20 values. Historical season snapshots preserve prior ratings rather than overwriting career history.

Hidden generation and development variables are stored in a non-exposed `private` schema.

## Security model

The browser may read registry data for authorized application users.

Player creation, career advancement, and retirement are privileged backend operations. Individual ratings are never directly writable from the browser.

The commissioner can edit generator configuration for future players, but cannot directly change an existing player's ability ratings.

## Versioning

Each player stores the generator version used to create them.

Each post-season development run stores the development-model version and random seed used.

## Season calendar

CenturyLeague uses a monthly competition calendar: twelve seasons per calendar year. Season 1 is the November 2026 Inaugural Tournament. A completed season triggers one month of player aging/development and one month of retirement hazard before the next season begins.

Changing a model does not retroactively regenerate existing players.


## Independent league timelines

Men's and women's Century competitions run independently.

Each competition category has its own league-state record, current season, season numbering, development cycle, entry windows, player population, free-agent pool, and roster history. Season numbers therefore have meaning only within a competition category.

The men's league is initialized first:
- Season 1: November 2026
- Inaugural Tournament
- planned founding population: 900 men
- planned roster capacity: 18 teams × 35 = 630

The women's league currently exists only as a planned league-state record. It has no current season and no player population until its launch date, team count, and founding-pool size are established.
