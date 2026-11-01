-- Minimal dependencies for a disposable PostgreSQL/WASM test database.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema private;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth,private to service_role;
grant usage on schema auth to authenticated;
create table public.app_users(user_id uuid primary key,role text not null);
create table public.seasons(id uuid primary key,status text,competition_category text,starts_on date);
create table public.teams(id uuid primary key,name text,competition_category text);
create table public.team_season_rosters(id uuid primary key,season_id uuid references public.seasons(id),team_id uuid references public.teams(id),match_team jsonb);
grant select on public.app_users,public.seasons,public.teams,public.team_season_rosters to service_role,authenticated;

grant update on public.app_users,public.seasons,public.team_season_rosters to service_role;
