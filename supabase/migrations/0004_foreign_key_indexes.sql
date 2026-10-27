-- CenturyLeague Player Registry v0.1
-- Cover foreign keys identified by Supabase performance advisor.

create index development_runs_created_by_idx on public.development_runs(created_by);
create index development_runs_to_season_idx on public.development_runs(to_season_id);
create index generation_batches_created_by_idx on public.generation_batches(created_by);
create index generation_batches_generator_version_idx on public.generation_batches(generator_version_id);
create index generator_versions_created_by_idx on public.generator_versions(created_by);
create index league_state_active_generator_version_idx on public.league_state(active_generator_version_id);
create index league_state_current_season_idx on public.league_state(current_season_id);
create index snapshots_season_idx on public.player_season_snapshots(season_id);
create index snapshots_team_idx on public.player_season_snapshots(team_id);
create index team_history_season_idx on public.player_team_history(season_id);
create index team_history_team_idx on public.player_team_history(team_id);
create index players_generation_batch_idx on public.players(generation_batch_id);
create index players_generator_version_idx on public.players(generator_version_id);
create index retirements_development_run_idx on public.retirements(development_run_id);
create index retirements_season_idx on public.retirements(season_id);
