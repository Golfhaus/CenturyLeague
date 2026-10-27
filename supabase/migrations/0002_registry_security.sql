-- CenturyLeague Player Registry v0.1
-- Browser access is read-only. Simulation writes are backend-only.

alter table public.app_users enable row level security;
alter table public.seasons enable row level security;
alter table public.generator_versions enable row level security;
alter table public.teams enable row level security;
alter table public.generation_batches enable row level security;
alter table public.players enable row level security;
alter table public.player_ratings_current enable row level security;
alter table public.player_season_snapshots enable row level security;
alter table public.player_team_history enable row level security;
alter table public.player_representative_eligibility enable row level security;
alter table public.development_runs enable row level security;
alter table public.retirements enable row level security;
alter table public.league_state enable row level security;

revoke all on table public.app_users from anon, authenticated;
revoke all on table public.seasons from anon, authenticated;
revoke all on table public.generator_versions from anon, authenticated;
revoke all on table public.teams from anon, authenticated;
revoke all on table public.generation_batches from anon, authenticated;
revoke all on table public.players from anon, authenticated;
revoke all on table public.player_ratings_current from anon, authenticated;
revoke all on table public.player_season_snapshots from anon, authenticated;
revoke all on table public.player_team_history from anon, authenticated;
revoke all on table public.player_representative_eligibility from anon, authenticated;
revoke all on table public.development_runs from anon, authenticated;
revoke all on table public.retirements from anon, authenticated;
revoke all on table public.league_state from anon, authenticated;

grant select on table public.app_users to authenticated;
grant select on table public.seasons to authenticated;
grant select on table public.generator_versions to authenticated;
grant select on table public.teams to authenticated;
grant select on table public.generation_batches to authenticated;
grant select on table public.players to authenticated;
grant select on table public.player_ratings_current to authenticated;
grant select on table public.player_season_snapshots to authenticated;
grant select on table public.player_team_history to authenticated;
grant select on table public.player_representative_eligibility to authenticated;
grant select on table public.development_runs to authenticated;
grant select on table public.retirements to authenticated;
grant select on table public.league_state to authenticated;

create policy app_users_read_self
on public.app_users for select
to authenticated
using ((select auth.uid()) = user_id);

create policy seasons_read_app_users on public.seasons for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create policy generator_versions_read_app_users on public.generator_versions for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create policy teams_read_app_users on public.teams for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create policy generation_batches_read_app_users on public.generation_batches for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create policy players_read_app_users on public.players for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create policy ratings_read_app_users on public.player_ratings_current for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create policy snapshots_read_app_users on public.player_season_snapshots for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create policy team_history_read_app_users on public.player_team_history for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create policy eligibility_read_app_users on public.player_representative_eligibility for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create policy development_runs_read_app_users on public.development_runs for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create policy retirements_read_app_users on public.retirements for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));

create policy league_state_read_app_users on public.league_state for select to authenticated
using (exists (select 1 from public.app_users u where u.user_id = (select auth.uid())));
