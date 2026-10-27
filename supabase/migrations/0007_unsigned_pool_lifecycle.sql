-- CenturyLeague unsigned-player lifecycle and quarterly entry windows.

alter table public.players
  drop constraint if exists players_status_check;

alter table public.players
  add constraint players_status_check
  check (status in ('active','retired','exited_pool'));

alter table public.players
  add column first_eligible_season_id uuid references public.seasons(id),
  add column entry_type text not null default 'entry_window',
  add column entry_class_label text,
  add column pool_exited_at timestamptz;

alter table public.players
  add constraint players_entry_type_check
  check (entry_type in ('founding_pool','entry_window'));

alter table private.player_generation_metadata
  add column career_persistence numeric(6,3);

update private.player_generation_metadata
set career_persistence = 10.5
where career_persistence is null;

alter table private.player_generation_metadata
  alter column career_persistence set not null,
  add constraint player_generation_metadata_career_persistence_check
  check (career_persistence between 1 and 20);

create table public.entry_windows (
  id uuid primary key default gen_random_uuid(),
  trigger_season_id uuid not null unique references public.seasons(id),
  available_season_id uuid references public.seasons(id),
  window_name text not null,
  class_label text not null,
  status text not null default 'planned'
    check (status in ('planned','open','closed')),
  target_active_population integer,
  target_free_agent_population integer,
  generated_count integer not null default 0 check (generated_count >= 0),
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz
);

create table public.player_pool_exits (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players(id) on delete cascade,
  season_id uuid not null references public.seasons(id),
  entry_window_id uuid references public.entry_windows(id),
  exit_age_years numeric(7,4) not null check (exit_age_years >= 0),
  reason text not null default 'left_player_pool',
  created_at timestamptz not null default now()
);

create table private.player_pool_exit_evaluations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season_id uuid not null references public.seasons(id),
  entry_window_id uuid references public.entry_windows(id),
  age_years numeric(7,4) not null,
  unsigned_months integer not null check (unsigned_months >= 0),
  market_percentile numeric(7,6) not null check (market_percentile between 0 and 1),
  twelve_month_overall_trend numeric(8,4) not null default 0,
  previously_rostered boolean not null,
  months_since_release integer,
  career_persistence numeric(6,3) not null check (career_persistence between 1 and 20),
  free_agent_count integer not null check (free_agent_count >= 0),
  target_free_agent_count integer not null check (target_free_agent_count > 0),
  base_probability numeric(9,8) not null check (base_probability between 0 and 1),
  pool_pressure_multiplier numeric(7,6) not null,
  exit_probability numeric(9,8) not null check (exit_probability between 0 and 1),
  random_roll numeric(9,8) not null check (random_roll between 0 and 1),
  exited boolean not null,
  components jsonb not null,
  created_at timestamptz not null default now(),
  unique (player_id, season_id)
);

alter table public.entry_windows enable row level security;
alter table public.player_pool_exits enable row level security;

revoke all on table public.entry_windows from anon, authenticated;
revoke all on table public.player_pool_exits from anon, authenticated;

grant select on table public.entry_windows to authenticated;
grant select on table public.player_pool_exits to authenticated;

create policy entry_windows_read_app_users
on public.entry_windows for select to authenticated
using (exists (
  select 1 from public.app_users u
  where u.user_id = (select auth.uid())
));

create policy pool_exits_read_app_users
on public.player_pool_exits for select to authenticated
using (exists (
  select 1 from public.app_users u
  where u.user_id = (select auth.uid())
));

create index players_first_eligible_season_idx
  on public.players(first_eligible_season_id);

create index entry_windows_available_season_idx
  on public.entry_windows(available_season_id);

create index pool_exits_season_idx
  on public.player_pool_exits(season_id);

create index pool_exits_entry_window_idx
  on public.player_pool_exits(entry_window_id);

create index pool_exit_evaluations_player_idx
  on private.player_pool_exit_evaluations(player_id);

create index pool_exit_evaluations_season_idx
  on private.player_pool_exit_evaluations(season_id);

update public.generator_versions
set config = jsonb_set(
      config,
      '{population_management}',
      '{
        "initial_roster_capacity": 630,
        "default_initial_active_population": 900,
        "default_target_free_agents": 270,
        "entry_window_months": [3, 6, 9, 12],
        "pool_exit_evaluation": "quarterly",
        "pool_pressure_multiplier_min": 0.85,
        "pool_pressure_multiplier_max": 1.20
      }'::jsonb,
      true
    ),
    notes = coalesce(notes, '') || ' Quarterly player entry windows and unsigned-player attrition established.'
where version_name = 'Century Player Generator v1.0';
