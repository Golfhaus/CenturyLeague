-- CenturyLeague monthly season cadence
-- One Century season is one calendar month. Season 1 is November 2026.

alter table public.seasons
  drop constraint if exists seasons_season_year_key;

alter table public.seasons
  add column season_number integer,
  add column season_month integer,
  add column starts_on date,
  add column ends_on date,
  add column event_name text;

alter table public.seasons
  add constraint seasons_season_number_key unique (season_number),
  add constraint seasons_year_month_key unique (season_year, season_month),
  add constraint seasons_season_month_check check (season_month between 1 and 12),
  add constraint seasons_date_order_check check (starts_on is null or ends_on is null or starts_on <= ends_on);

alter table public.player_season_snapshots
  drop constraint if exists player_season_snapshots_age_check;

alter table public.player_season_snapshots
  rename column age to age_years;

alter table public.player_season_snapshots
  alter column age_years type numeric(7,4) using age_years::numeric;

alter table public.player_season_snapshots
  add constraint player_season_snapshots_age_years_check check (age_years >= 0);

alter table public.retirements
  rename column retirement_age to retirement_age_years;

alter table public.retirements
  alter column retirement_age_years type numeric(7,4) using retirement_age_years::numeric;

alter table public.retirements
  add constraint retirements_retirement_age_years_check check (retirement_age_years >= 0);

insert into public.seasons (
  season_number,
  season_year,
  season_month,
  starts_on,
  ends_on,
  label,
  event_name,
  status
)
values (
  1,
  2026,
  11,
  date '2026-11-01',
  date '2026-11-30',
  'Season 1 — November 2026',
  'Inaugural Tournament',
  'setup'
)
on conflict (season_number) do update
set season_year = excluded.season_year,
    season_month = excluded.season_month,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    label = excluded.label,
    event_name = excluded.event_name,
    updated_at = now();

update public.league_state
set current_season_id = (
      select id from public.seasons where season_number = 1
    ),
    active_development_model_version = '1.1.0',
    updated_at = now()
where id = 1;

update public.generator_versions
set config = jsonb_set(
      jsonb_set(
        config,
        '{development_model_version}',
        '"1.1.0"'::jsonb,
        true
      ),
      '{season_calendar}',
      '{
        "cadence": "monthly",
        "seasons_per_year": 12,
        "inaugural_season_number": 1,
        "inaugural_season_year": 2026,
        "inaugural_season_month": 11
      }'::jsonb,
      true
    ),
    notes = coalesce(notes, '') || ' Monthly season cadence established beginning November 2026.'
where version_name = 'Century Player Generator v1.0';
