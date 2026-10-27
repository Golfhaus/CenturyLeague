-- CenturyLeague independent men's and women's league timelines.
-- Men's league is initialized for November 2026. Women's league remains planned/uninitialized.

alter table public.seasons
  add column competition_category text;

update public.seasons
set competition_category = 'men'
where competition_category is null;

alter table public.seasons
  alter column competition_category set not null,
  add constraint seasons_competition_category_check
    check (competition_category in ('men','women'));

alter table public.seasons
  drop constraint if exists seasons_season_number_key,
  drop constraint if exists seasons_year_month_key;

alter table public.seasons
  add constraint seasons_category_number_key
    unique (competition_category, season_number),
  add constraint seasons_category_year_month_key
    unique (competition_category, season_year, season_month);

alter table public.generation_batches
  add column competition_category text;

update public.generation_batches gb
set competition_category = p.competition_category
from (
  select generation_batch_id, min(competition_category) as competition_category
  from public.players
  group by generation_batch_id
) p
where p.generation_batch_id = gb.id
  and gb.competition_category is null;

update public.generation_batches
set competition_category = 'men'
where competition_category is null;

alter table public.generation_batches
  alter column competition_category set not null,
  add constraint generation_batches_competition_category_check
    check (competition_category in ('men','women'));

alter table public.entry_windows
  add column competition_category text;

update public.entry_windows ew
set competition_category = s.competition_category
from public.seasons s
where s.id = ew.trigger_season_id
  and ew.competition_category is null;

alter table public.entry_windows
  alter column competition_category set not null,
  add constraint entry_windows_competition_category_check
    check (competition_category in ('men','women'));

alter table public.development_runs
  add column competition_category text;

update public.development_runs dr
set competition_category = s.competition_category
from public.seasons s
where s.id = dr.from_season_id
  and dr.competition_category is null;

alter table public.development_runs
  alter column competition_category set not null,
  add constraint development_runs_competition_category_check
    check (competition_category in ('men','women'));

alter table public.league_state
  drop constraint if exists league_state_id_check;

alter table public.league_state
  add column competition_category text,
  add column league_status text not null default 'planned';

update public.league_state
set competition_category = 'men',
    league_status = 'active'
where id = 1;

alter table public.league_state
  alter column competition_category set not null,
  add constraint league_state_competition_category_check
    check (competition_category in ('men','women')),
  add constraint league_state_league_status_check
    check (league_status in ('planned','active','paused')),
  add constraint league_state_competition_category_key
    unique (competition_category);

insert into public.league_state (
  id,
  competition_category,
  league_status,
  current_season_id,
  active_generator_version_id,
  active_development_model_version
)
select
  2,
  'women',
  'planned',
  null,
  active_generator_version_id,
  active_development_model_version
from public.league_state
where competition_category = 'men'
on conflict (id) do update
set competition_category = excluded.competition_category,
    league_status = 'planned',
    current_season_id = null,
    active_generator_version_id = excluded.active_generator_version_id,
    active_development_model_version = excluded.active_development_model_version,
    updated_at = now();

create index seasons_category_number_idx
  on public.seasons(competition_category, season_number);

create index seasons_category_date_idx
  on public.seasons(competition_category, starts_on);

create index generation_batches_category_idx
  on public.generation_batches(competition_category);

create index entry_windows_category_idx
  on public.entry_windows(competition_category);

create index development_runs_category_idx
  on public.development_runs(competition_category);

update public.generator_versions
set config = jsonb_set(
      config,
      '{population_management}',
      '{
        "leagues": {
          "men": {
            "status": "active",
            "initial_teams": 18,
            "roster_size": 35,
            "initial_roster_capacity": 630,
            "default_initial_active_population": 900,
            "default_target_free_agents": 270,
            "inaugural_season": {
              "season_number": 1,
              "year": 2026,
              "month": 11,
              "event_name": "Inaugural Tournament"
            }
          },
          "women": {
            "status": "planned",
            "initial_teams": null,
            "roster_size": 35,
            "initial_roster_capacity": null,
            "default_initial_active_population": null,
            "default_target_free_agents": null,
            "inaugural_season": null
          }
        },
        "entry_window_months": [3, 6, 9, 12],
        "pool_exit_evaluation": "quarterly",
        "pool_pressure_multiplier_min": 0.85,
        "pool_pressure_multiplier_max": 1.20
      }'::jsonb,
      true
    ),
    notes = coalesce(notes, '') || ' Men and women now maintain independent league timelines and populations; men initialized November 2026, women planned.'
where version_name = 'Century Player Generator v1.0';
