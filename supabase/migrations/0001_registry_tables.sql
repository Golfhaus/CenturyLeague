-- CenturyLeague Player Registry v0.1
-- Core tables and indexes.

create schema if not exists private;
revoke all on schema private from public;

create table public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('commissioner','viewer')),
  created_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  season_year integer not null unique,
  label text not null,
  status text not null default 'setup' check (status in ('setup','active','complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generator_versions (
  id uuid primary key default gen_random_uuid(),
  version_name text not null unique,
  model_version text not null,
  config jsonb not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  competition_category text not null check (competition_category in ('men','women')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (competition_category, name)
);

create table public.generation_batches (
  id uuid primary key default gen_random_uuid(),
  generator_version_id uuid not null references public.generator_versions(id),
  mode text not null check (mode in ('actual','test')),
  requested_count integer not null check (requested_count > 0),
  generated_count integer not null default 0 check (generated_count >= 0),
  seed text not null,
  committed boolean not null default false,
  summary jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  competition_category text not null check (competition_category in ('men','women')),
  date_of_birth date not null,
  birthplace_city text,
  birthplace_region_code text,
  birthplace_region_name text,
  birthplace_country_code text not null,
  birthplace_country_name text not null,
  nationality_code text,
  nationality_name text,
  preferred_side text not null default 'right' check (preferred_side in ('left','right','both')),
  height_cm numeric(5,2) not null check (height_cm > 0),
  weight_kg numeric(5,2) not null check (weight_kg > 0),
  primary_archetype text not null,
  secondary_archetype text,
  status text not null default 'active' check (status in ('active','retired')),
  current_team_id uuid references public.teams(id),
  generation_batch_id uuid not null references public.generation_batches(id),
  generator_version_id uuid not null references public.generator_versions(id),
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create table private.player_generation_metadata (
  player_id uuid primary key references public.players(id) on delete cascade,
  entry_age integer not null check (entry_age between 16 and 26),
  talent_class text not null check (talent_class in ('below_average','average','above_average','star','exceptional')),
  talent_latent numeric(8,5) not null,
  athleticism numeric(8,5) not null,
  power numeric(8,5) not null,
  coordination numeric(8,5) not null,
  endurance numeric(8,5) not null,
  game_sense numeric(8,5) not null,
  specialization numeric(6,3) not null check (specialization between 1 and 20),
  development_potential numeric(6,3) not null check (development_potential between 1 and 20),
  development_speed numeric(6,3) not null check (development_speed between 1 and 20),
  physical_peak_offset numeric(6,3) not null,
  technical_peak_offset numeric(6,3) not null,
  mental_peak_offset numeric(6,3) not null,
  decline_rate numeric(6,3) not null check (decline_rate between 1 and 20),
  longevity numeric(6,3) not null check (longevity between 1 and 20),
  retirement_tendency numeric(6,3) not null check (retirement_tendency between 1 and 20),
  geo_distance integer,
  geo_generation_tier text,
  off_profile_gift boolean not null default false,
  extreme_outlier boolean not null default false,
  generation_metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.player_ratings_current (
  player_id uuid primary key references public.players(id) on delete cascade,
  speed numeric(6,4) not null check (speed between 1 and 20),
  acceleration numeric(6,4) not null check (acceleration between 1 and 20),
  agility numeric(6,4) not null check (agility between 1 and 20),
  strength numeric(6,4) not null check (strength between 1 and 20),
  vertical_leap numeric(6,4) not null check (vertical_leap between 1 and 20),
  stamina numeric(6,4) not null check (stamina between 1 and 20),
  durability numeric(6,4) not null check (durability between 1 and 20),
  recovery numeric(6,4) not null check (recovery between 1 and 20),
  kicking_power numeric(6,4) not null check (kicking_power between 1 and 20),
  kicking_accuracy numeric(6,4) not null check (kicking_accuracy between 1 and 20),
  kicking_on_run numeric(6,4) not null check (kicking_on_run between 1 and 20),
  opposite_side_skill numeric(6,4) not null check (opposite_side_skill between 1 and 20),
  hand_passing numeric(6,4) not null check (hand_passing between 1 and 20),
  ball_carrying numeric(6,4) not null check (ball_carrying between 1 and 20),
  evasion numeric(6,4) not null check (evasion between 1 and 20),
  aerial_marking numeric(6,4) not null check (aerial_marking between 1 and 20),
  contested_possession numeric(6,4) not null check (contested_possession between 1 and 20),
  ground_ball_skill numeric(6,4) not null check (ground_ball_skill between 1 and 20),
  tackling numeric(6,4) not null check (tackling between 1 and 20),
  defensive_spoiling numeric(6,4) not null check (defensive_spoiling between 1 and 20),
  awareness numeric(6,4) not null check (awareness between 1 and 20),
  decision_making numeric(6,4) not null check (decision_making between 1 and 20),
  anticipation numeric(6,4) not null check (anticipation between 1 and 20),
  composure numeric(6,4) not null check (composure between 1 and 20),
  discipline numeric(6,4) not null check (discipline between 1 and 20),
  defensive_rating numeric(6,4) not null check (defensive_rating between 1 and 20),
  central_rating numeric(6,4) not null check (central_rating between 1 and 20),
  attacking_rating numeric(6,4) not null check (attacking_rating between 1 and 20),
  overall_rating numeric(6,4) not null check (overall_rating between 1 and 20),
  best_role text not null check (best_role in ('defensive','central','attacking')),
  updated_at timestamptz not null default now()
);

create table public.player_season_snapshots (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season_id uuid not null references public.seasons(id),
  age integer not null check (age >= 0),
  team_id uuid references public.teams(id),
  status text not null check (status in ('active','retired')),
  speed numeric(6,4) not null check (speed between 1 and 20),
  acceleration numeric(6,4) not null check (acceleration between 1 and 20),
  agility numeric(6,4) not null check (agility between 1 and 20),
  strength numeric(6,4) not null check (strength between 1 and 20),
  vertical_leap numeric(6,4) not null check (vertical_leap between 1 and 20),
  stamina numeric(6,4) not null check (stamina between 1 and 20),
  durability numeric(6,4) not null check (durability between 1 and 20),
  recovery numeric(6,4) not null check (recovery between 1 and 20),
  kicking_power numeric(6,4) not null check (kicking_power between 1 and 20),
  kicking_accuracy numeric(6,4) not null check (kicking_accuracy between 1 and 20),
  kicking_on_run numeric(6,4) not null check (kicking_on_run between 1 and 20),
  opposite_side_skill numeric(6,4) not null check (opposite_side_skill between 1 and 20),
  hand_passing numeric(6,4) not null check (hand_passing between 1 and 20),
  ball_carrying numeric(6,4) not null check (ball_carrying between 1 and 20),
  evasion numeric(6,4) not null check (evasion between 1 and 20),
  aerial_marking numeric(6,4) not null check (aerial_marking between 1 and 20),
  contested_possession numeric(6,4) not null check (contested_possession between 1 and 20),
  ground_ball_skill numeric(6,4) not null check (ground_ball_skill between 1 and 20),
  tackling numeric(6,4) not null check (tackling between 1 and 20),
  defensive_spoiling numeric(6,4) not null check (defensive_spoiling between 1 and 20),
  awareness numeric(6,4) not null check (awareness between 1 and 20),
  decision_making numeric(6,4) not null check (decision_making between 1 and 20),
  anticipation numeric(6,4) not null check (anticipation between 1 and 20),
  composure numeric(6,4) not null check (composure between 1 and 20),
  discipline numeric(6,4) not null check (discipline between 1 and 20),
  defensive_rating numeric(6,4) not null check (defensive_rating between 1 and 20),
  central_rating numeric(6,4) not null check (central_rating between 1 and 20),
  attacking_rating numeric(6,4) not null check (attacking_rating between 1 and 20),
  overall_rating numeric(6,4) not null check (overall_rating between 1 and 20),
  best_role text not null check (best_role in ('defensive','central','attacking')),
  model_version text not null,
  created_at timestamptz not null default now(),
  unique (player_id, season_id)
);

create table public.player_team_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid references public.teams(id),
  season_id uuid references public.seasons(id),
  transaction_type text not null default 'assignment',
  effective_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text
);

create table public.player_representative_eligibility (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  eligibility_type text not null,
  eligibility_code text not null,
  eligibility_name text not null,
  source text not null default 'birthplace',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (player_id, eligibility_type, eligibility_code)
);

create table public.development_runs (
  id uuid primary key default gen_random_uuid(),
  from_season_id uuid not null references public.seasons(id),
  to_season_id uuid not null references public.seasons(id),
  model_version text not null,
  seed text not null,
  status text not null default 'started' check (status in ('started','completed','failed')),
  summary jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (from_season_id, to_season_id)
);

create table public.retirements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players(id) on delete cascade,
  season_id uuid not null references public.seasons(id),
  retirement_age integer not null,
  final_overall numeric(6,4) not null check (final_overall between 1 and 20),
  reason text not null default 'career_retirement',
  development_run_id uuid references public.development_runs(id),
  created_at timestamptz not null default now()
);

create table public.league_state (
  id smallint primary key default 1 check (id = 1),
  current_season_id uuid references public.seasons(id),
  active_generator_version_id uuid references public.generator_versions(id),
  active_development_model_version text not null default '1.0',
  updated_at timestamptz not null default now()
);

insert into public.league_state (id) values (1)
on conflict (id) do nothing;

create index players_status_idx on public.players(status);
create index players_team_idx on public.players(current_team_id);
create index players_birth_region_idx on public.players(birthplace_country_code, birthplace_region_code);
create index players_archetype_idx on public.players(primary_archetype);
create index ratings_overall_idx on public.player_ratings_current(overall_rating desc);
create index snapshots_player_season_idx on public.player_season_snapshots(player_id, season_id);
create index team_history_player_idx on public.player_team_history(player_id, effective_at);
