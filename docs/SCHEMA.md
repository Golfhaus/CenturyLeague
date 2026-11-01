# CenturyLeague Database Model

## Public identity and state

### app_users

Application authorization record tied to Supabase Auth.

### seasons

Persistent monthly Century season records.

Each row contains a global season number, calendar year/month, start/end dates, display label, and optional event name. The inaugural record is Season 1 — November 2026, with event name Inaugural Tournament. There are twelve normal seasons per calendar year.

### generator_versions

Versioned universe-level player-generation configuration.

### teams

Team identity and competition category.

### coaches

One original founding coach per team, with its source identity, complete profile and validated ten tactical sliders. Registered app users have read access; browser roles cannot write.

### roster_imports

One audited founding import per season/category, with source, population and payload digests, execution role, completion time and summary. The privileged importer returns the same receipt on exact retry and rejects changed inputs.

### team_season_rosters

Pinned public match-team input for each imported season/team, preserving draft order, all 35 player identities and 25 abilities, coaching preferences, and references to the coach and import receipt. Registered app users have read access; browser roles cannot write.

### generation_batches

Records every actual or disposable/test population generation run, including random seed and summary.

### players

Permanent player identity and current career state:

- name
- competition category
- date of birth
- birthplace
- nationality
- preferred side
- height and weight
- archetypes
- active/retired/exited-pool state
- current team
- generator provenance

### player_ratings_current

Continuous current values for all 25 abilities plus defensive, central, attacking, and overall derived ratings.

### player_season_snapshots

Immutable month-by-month historical copy of ratings and roster state. The stored `age_years` value is fractional so players age correctly across monthly seasons.

The initial founding import completes only the initially empty team assignment in existing setup-season snapshots. It does not replace their names, abilities, derived ratings or other historical fields.

### player_team_history

Team assignment history.

### player_representative_eligibility

Birthplace and future representative-team eligibility records.

### entry_windows

Quarterly player-entry windows associated with the March, June, September, and December trigger seasons. Stores the target population and generated class size for auditability.

### player_pool_exits

Permanent public record that an unsigned player left the eligible Century player pool. This is separate from retirement.

### development_runs

One record for each league-wide post-season advancement transaction. Under the normal cadence this occurs once per month, from one season record to the next.

### retirements

Retirement result and final career state.

### league_state

Singleton record identifying the current season and active models.

## Private simulation metadata

### private.roster_import_payloads

Backend-only archived canonical import payload, linked to its audit receipt. It contains draft player UUIDs and original coach profiles; it does not export private player development fields. Browser roles cannot read or write this archive.

### private.player_generation_metadata

Hidden values used to maintain coherent career progression:

- entry age
- latent talent
- five foundations
- specialization
- development potential
- development speed
- physical/technical/mental peak offsets
- decline rate
- longevity
- retirement tendency
- Career Persistence
- geographic-generation metadata
- outlier flags

These values are not exposed through the normal Data API.

### private.player_pool_exit_evaluations

Audit record for every quarterly unsigned-player evaluation, including players who remain eligible. Stores probability inputs, formula components, population-pressure multiplier, random roll, and outcome.

## Ability editing rule

There is no normal browser update permission on `player_ratings_current`.

Ratings may be changed only by privileged generation and lifecycle operations.

## Historical rule

Season advancement never destroys the prior state. Ratings in a season snapshot are the ratings used during that calendar month. After the season ends, lifecycle processing creates the ratings for the next monthly season, so a player's career can be reconstructed month by month.


## Active full-name uniqueness

The database enforces a case-insensitive unique full-name rule for rows in `players` whose status is `active`.

This is a partial unique index, so historical name reuse is allowed after a player becomes `retired` or `exited_pool`. Application-level generation also reserves active names before preview, but the database index remains authoritative if application logic ever fails.
