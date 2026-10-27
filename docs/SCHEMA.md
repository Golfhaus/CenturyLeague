# CenturyLeague Database Model

## Public identity and state

### app_users

Application authorization record tied to Supabase Auth.

### seasons

Persistent Century season records.

### generator_versions

Versioned universe-level player-generation configuration.

### teams

Team identity and competition category.

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
- active/retired state
- current team
- generator provenance

### player_ratings_current

Continuous current values for all 25 abilities plus defensive, central, attacking, and overall derived ratings.

### player_season_snapshots

Immutable season-by-season historical copy of ratings and roster state.

### player_team_history

Team assignment history.

### player_representative_eligibility

Birthplace and future representative-team eligibility records.

### development_runs

One record for each league-wide offseason advancement transaction.

### retirements

Retirement result and final career state.

### league_state

Singleton record identifying the current season and active models.

## Private simulation metadata

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
- geographic-generation metadata
- outlier flags

These values are not exposed through the normal Data API.

## Ability editing rule

There is no normal browser update permission on `player_ratings_current`.

Ratings may be changed only by privileged generation and lifecycle operations.

## Historical rule

Season advancement never destroys the prior state. A snapshot is created for each season so a player's ratings at any previous age remain recoverable.
