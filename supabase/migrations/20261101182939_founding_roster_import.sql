-- Founding draft import: schema only; no canonical player/coach payload is committed here.
create extension if not exists pgcrypto with schema extensions;

create function private.valid_coach_tactics_v1(p jsonb)
returns boolean language sql immutable parallel safe security invoker set search_path = ''
as $$
  select case when jsonb_typeof(p) = 'object' then
    (select count(*) = 10 from jsonb_object_keys(p))
    and p ?& array['tempo','physicality','defensive_posture','pressure','transition_emphasis','width',
      'aerial_emphasis','ball_risk','running_movement_emphasis','defensive_aggression']
    and not exists (select 1 from jsonb_each(p) e where not
      case when jsonb_typeof(e.value) = 'number' then (e.value::text)::numeric between 1 and 5 else false end)
  else false end;
$$;
revoke all on function private.valid_coach_tactics_v1(jsonb) from public, anon, authenticated;
grant execute on function private.valid_coach_tactics_v1(jsonb) to service_role;

create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id),
  source_coach_id text not null unique,
  name text not null check (btrim(name) <> ''),
  tactical_sliders jsonb not null check (private.valid_coach_tactics_v1(tactical_sliders)),
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  created_at timestamptz not null default now(),
  check (profile->>'name' = name and profile->>'coach_id' = source_coach_id
    and profile->'tactical_sliders' = tactical_sliders)
);
create table public.roster_imports (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id),
  competition_category text not null check (competition_category in ('men','women')),
  source_sha256 text[] not null check (cardinality(source_sha256) = 3),
  population_sha256 text not null check (population_sha256 ~ '^[a-f0-9]{64}$'),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  summary jsonb not null,
  executed_by_role text not null default current_user,
  completed_at timestamptz not null default now(),
  unique (season_id, competition_category)
);
create table private.roster_import_payloads (
  import_id uuid primary key references public.roster_imports(id),
  payload jsonb not null
);
create table public.team_season_rosters (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id),
  team_id uuid not null references public.teams(id),
  coach_id uuid not null references public.coaches(id),
  roster_import_id uuid not null references public.roster_imports(id),
  match_team jsonb not null check (jsonb_typeof(match_team) = 'object'
    and jsonb_typeof(match_team->'players') = 'array' and jsonb_array_length(match_team->'players') = 35),
  created_at timestamptz not null default now(),
  unique (season_id, team_id)
);
create index team_season_rosters_team_idx on public.team_season_rosters(team_id,season_id);
create index team_season_rosters_coach_idx on public.team_season_rosters(coach_id);
create index team_season_rosters_import_idx on public.team_season_rosters(roster_import_id);

alter table public.coaches enable row level security;
alter table public.roster_imports enable row level security;
alter table public.team_season_rosters enable row level security;
alter table private.roster_import_payloads enable row level security;
revoke all on public.coaches, public.roster_imports, public.team_season_rosters from anon, authenticated;
revoke all on private.roster_import_payloads from public, anon, authenticated;
grant select on public.coaches, public.roster_imports, public.team_season_rosters to authenticated;
grant all on public.coaches, public.roster_imports, public.team_season_rosters, private.roster_import_payloads to service_role;
grant usage on schema private to service_role;
create policy coaches_registered_read on public.coaches for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));
create policy roster_imports_registered_read on public.roster_imports for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));
create policy season_rosters_registered_read on public.team_season_rosters for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create function public.import_founding_rosters_v1(
  p_season_id uuid, p_source_sha256 text[], p_population_sha256 text, p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_season public.seasons%rowtype;
  v_league public.league_state%rowtype;
  v_prior public.roster_imports%rowtype;
  v_team jsonb;
  v_import_id uuid;
  v_count integer;
  v_hash text;
  v_snapshot_hash text;
  v_summary jsonb;
  v_columns constant text[] := array['speed','acceleration','agility','strength','vertical_leap','stamina',
    'durability','recovery','kicking_power','kicking_accuracy','kicking_on_run','opposite_side_skill',
    'hand_passing','ball_carrying','evasion','aerial_marking','contested_possession','ground_ball_skill',
    'tackling','defensive_spoiling','awareness','decision_making','anticipation','composure','discipline'];
  v_keys constant text[] := array['speed','acceleration','agility','strength','verticalLeap','stamina',
    'durability','recovery','kickingPower','kickingAccuracy','kickingOnRun','oppositeSideSkill',
    'handPassing','ballCarrying','evasion','aerialMarking','contestedPossession','groundBallSkill',
    'tackling','defensiveSpoiling','awareness','decisionMaking','anticipation','composure','discipline'];
begin
  if p_season_id is null or p_population_sha256 is null or p_population_sha256 !~ '^[a-f0-9]{64}$'
    or p_source_sha256 is null or cardinality(p_source_sha256) <> 3
    or exists (select 1 from unnest(p_source_sha256) h where h is null or h !~ '^[a-f0-9]{64}$') then
    raise exception 'Invalid founding import identity/fingerprints';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Import payload must be an object'; end if;
  if (select count(*) from jsonb_object_keys(p_payload)) <> 2
    or coalesce(p_payload->>'competitionCategory','') not in ('men','women') then
    raise exception 'Invalid import scope';
  end if;
  perform pg_advisory_xact_lock(hashtext('century-founding-rosters-v1'),hashtext(p_season_id::text));
  select * into v_league from public.league_state where competition_category = p_payload->>'competitionCategory' for update;
  select * into v_season from public.seasons where id = p_season_id for update;
  if not found or v_season.competition_category is distinct from p_payload->>'competitionCategory' then
    raise exception 'Season/category mismatch';
  end if;
  select * into v_prior from public.roster_imports where season_id = p_season_id and competition_category = v_season.competition_category;
  if found then
    if v_prior.source_sha256 is distinct from p_source_sha256 or v_prior.population_sha256 is distinct from p_population_sha256
      or not exists (select 1 from private.roster_import_payloads where import_id = v_prior.id and payload = p_payload) then
      raise exception 'Conflicting founding import already exists';
    end if;
    return jsonb_build_object('applied',false,'importId',v_prior.id,'summary',v_prior.summary);
  end if;
  if v_season.season_number <> 1 or v_season.status <> 'setup'
    or v_league.current_season_id is distinct from p_season_id or v_league.league_status <> 'active' then
    raise exception 'Initial active league in setup season required';
  end if;
  if jsonb_typeof(p_payload->'teams') is distinct from 'array' or jsonb_array_length(p_payload->'teams') <> 18 then
    raise exception 'Exactly 18 founding teams required';
  end if;
  for v_team in select value from jsonb_array_elements(p_payload->'teams') loop
    if jsonb_typeof(v_team) is distinct from 'object' or (select count(*) from jsonb_object_keys(v_team)) <> 3
      or not v_team ?& array['name','coach','playerIds'] or coalesce(btrim(v_team->>'name'),'') = ''
      or jsonb_typeof(v_team->'playerIds') is distinct from 'array' or jsonb_array_length(v_team->'playerIds') <> 35 then
      raise exception 'Each team needs a name, coach and exactly 35 player IDs';
    end if;
    if jsonb_typeof(v_team->'coach') is distinct from 'object'
      or coalesce(v_team#>>'{coach,name}','') = '' or coalesce(v_team#>>'{coach,coach_id}','') = ''
      or v_team#>>'{coach,team}' is distinct from v_team->>'name'
      or not private.valid_coach_tactics_v1(v_team#>'{coach,tactical_sliders}') then
      raise exception 'Invalid original coach profile/preferences';
    end if;
  end loop;
  if (select count(distinct value->>'name') from jsonb_array_elements(p_payload->'teams')) <> 18
    or (select count(distinct value#>>'{coach,coach_id}') from jsonb_array_elements(p_payload->'teams')) <> 18 then
    raise exception 'Founding teams/coaches must be unique';
  end if;
  create temporary table _century_founding_players_v1 (
    player_id uuid primary key, team_name text not null, ordinal integer not null
  ) on commit drop;
  insert into pg_temp._century_founding_players_v1
  select p.value::uuid,t.value->>'name',p.ordinality::integer
  from jsonb_array_elements(p_payload->'teams') t
  cross join lateral jsonb_array_elements_text(t.value->'playerIds') with ordinality p(value,ordinality);
  select count(*) into v_count from pg_temp._century_founding_players_v1;
  if v_count <> 630 then raise exception 'Exactly 630 distinct drafted players required'; end if;

  -- Pin the whole initial active pool while checking it against the canonical snapshot.
  perform p.id from public.players p join public.player_ratings_current r on r.player_id = p.id
    where p.competition_category = v_season.competition_category and p.status = 'active' order by p.id for update of p,r;
  perform s.id from public.player_season_snapshots s join public.players p on p.id = s.player_id
    where s.season_id = p_season_id and p.competition_category = v_season.competition_category order by p.id for update of s;
  select count(*) into v_count from public.players p join public.player_ratings_current r on r.player_id = p.id
    where p.competition_category = v_season.competition_category and p.status = 'active';
  if v_count <> 900 then raise exception 'Canonical 900-player founding population required'; end if;
  select encode(extensions.digest(string_agg(p.id::text||'|'||p.first_name||'|'||p.last_name||'|'||
    (select string_agg(((to_jsonb(r)->>a.key)::numeric(6,4))::text,'|' order by a.ord)
      from unnest(v_columns) with ordinality a(key,ord)),E'\n' order by p.id),'sha256'),'hex') into v_hash
    from public.players p join public.player_ratings_current r on r.player_id = p.id
    where p.competition_category = v_season.competition_category and p.status = 'active';
  select encode(extensions.digest(string_agg(p.id::text||'|'||p.first_name||'|'||p.last_name||'|'||
    (select string_agg(((to_jsonb(s)->>a.key)::numeric(6,4))::text,'|' order by a.ord)
      from unnest(v_columns) with ordinality a(key,ord)),E'\n' order by p.id),'sha256'),'hex') into v_snapshot_hash
    from public.players p join public.player_season_snapshots s on s.player_id = p.id and s.season_id = p_season_id
    where p.competition_category = v_season.competition_category and p.status = 'active';
  if v_hash is distinct from p_population_sha256 or v_snapshot_hash is distinct from p_population_sha256 then
    raise exception 'Canonical player identity/ability or season snapshot fingerprint mismatch';
  end if;
  if (select count(*) from pg_temp._century_founding_players_v1 d join public.players p on p.id = d.player_id
    where p.competition_category = v_season.competition_category and p.status = 'active') <> 630 then
    raise exception 'Missing/ineligible/cross-league drafted player';
  end if;
  if exists (select 1 from pg_temp._century_founding_players_v1 d join public.players p on p.id=d.player_id where p.current_team_id is not null)
    or exists (select 1 from pg_temp._century_founding_players_v1 d join public.player_season_snapshots s on s.player_id=d.player_id
      where s.season_id=p_season_id and s.team_id is not null)
    or exists (select 1 from pg_temp._century_founding_players_v1 d join public.player_team_history h on h.player_id=d.player_id
      where h.team_id is not null and h.ended_at is null) then
    raise exception 'Existing roster assignment conflicts with initial draft import';
  end if;

  lock table public.teams, public.coaches in share row exclusive mode;
  insert into public.teams(name,competition_category)
    select value->>'name',v_season.competition_category from jsonb_array_elements(p_payload->'teams')
    on conflict (competition_category,name) do nothing;
  if exists (select 1 from public.teams t join jsonb_array_elements(p_payload->'teams') e on e.value->>'name'=t.name
    where t.competition_category=v_season.competition_category and not t.active) then raise exception 'Existing founding team is inactive'; end if;
  if exists (select 1 from jsonb_array_elements(p_payload->'teams') e join public.teams t
    on t.name=e.value->>'name' and t.competition_category=v_season.competition_category
    join public.coaches c on c.team_id=t.id or c.source_coach_id=e.value#>>'{coach,coach_id}'
    where c.team_id<>t.id or c.source_coach_id<>e.value#>>'{coach,coach_id}' or c.profile<>e.value->'coach') then
    raise exception 'Existing coach/profile conflicts with original founding coach';
  end if;
  insert into public.coaches(team_id,source_coach_id,name,tactical_sliders,profile)
    select t.id,e.value#>>'{coach,coach_id}',e.value#>>'{coach,name}',e.value#>'{coach,tactical_sliders}',e.value->'coach'
    from jsonb_array_elements(p_payload->'teams') e join public.teams t on t.name=e.value->>'name'
      and t.competition_category=v_season.competition_category on conflict (team_id) do nothing;
  insert into public.roster_imports(season_id,competition_category,source_sha256,population_sha256,payload_sha256,summary)
    values(p_season_id,v_season.competition_category,p_source_sha256,p_population_sha256,
      encode(extensions.digest(p_payload::text,'sha256'),'hex'),'{}'::jsonb) returning id into v_import_id;
  insert into private.roster_import_payloads values(v_import_id,p_payload);
  update public.player_team_history h set ended_at=now()
    from pg_temp._century_founding_players_v1 d where h.player_id=d.player_id and h.ended_at is null;
  insert into public.player_team_history(player_id,team_id,season_id,transaction_type,notes)
    select d.player_id,t.id,p_season_id,'draft','Founding draft import '||v_import_id::text
    from pg_temp._century_founding_players_v1 d join public.teams t on t.name=d.team_name and t.competition_category=v_season.competition_category;
  update public.players p set current_team_id=t.id
    from pg_temp._century_founding_players_v1 d join public.teams t on t.name=d.team_name and t.competition_category=v_season.competition_category
    where p.id=d.player_id and p.current_team_id is null;
  get diagnostics v_count = row_count;
  if v_count<>630 then raise exception 'Player assignment count mismatch'; end if;
  -- Complete only the initially unassigned roster field; historical ability values are never rewritten.
  update public.player_season_snapshots s set team_id=t.id
    from pg_temp._century_founding_players_v1 d join public.teams t on t.name=d.team_name and t.competition_category=v_season.competition_category
    where s.player_id=d.player_id and s.season_id=p_season_id and s.team_id is null;
  get diagnostics v_count = row_count;
  if v_count<>630 then raise exception 'Initial season roster assignment count mismatch'; end if;
  insert into public.team_season_rosters(season_id,team_id,coach_id,roster_import_id,match_team)
    select p_season_id,t.id,c.id,v_import_id,jsonb_build_object('id',t.id::text,'name',t.name,
      'coach',jsonb_build_object('name',c.name,'tactics',c.tactical_sliders),'players',
      (select jsonb_agg(jsonb_build_object('id',p.id::text,'name',p.first_name||' '||p.last_name,'ratings',
        (select jsonb_object_agg(v_keys[a.ord::integer],to_jsonb(r)->a.key) from unnest(v_columns) with ordinality a(key,ord))) order by d.ordinal)
        from pg_temp._century_founding_players_v1 d join public.players p on p.id=d.player_id
        join public.player_ratings_current r on r.player_id=p.id where d.team_name=t.name))
    from public.teams t join public.coaches c on c.team_id=t.id
    join jsonb_array_elements(p_payload->'teams') e on e.value->>'name'=t.name
    where t.competition_category=v_season.competition_category;
  v_summary:=jsonb_build_object('teams',18,'coaches',18,'assignedPlayers',630,'seasonRosters',18,
    'unassignedActivePlayers',(select count(*) from public.players where competition_category=v_season.competition_category and status='active' and current_team_id is null));
  update public.roster_imports set summary=v_summary where id=v_import_id;
  return jsonb_build_object('applied',true,'importId',v_import_id,'summary',v_summary);
end;
$$;
revoke all on function public.import_founding_rosters_v1(uuid,text[],text,jsonb) from public, anon, authenticated;
grant execute on function public.import_founding_rosters_v1(uuid,text[],text,jsonb) to service_role;
