-- Backend-generated proposals; browsers can read, never supply or mutate result ledgers.
create table public.competitions (
  id uuid primary key,
  season_id uuid not null references public.seasons(id),
  competition_category text not null check (competition_category in ('men','women')),
  classification text not null check (classification in ('exhibition','competitive')),
  name text not null check (length(name) between 1 and 160),
  definition jsonb not null,
  definition_sha256 text not null,
  status text not null default 'draft' check (status in ('draft','active','complete')),
  revision integer not null default 0 check (revision >= 0),
  created_by uuid not null references public.app_users(user_id),
  created_at timestamptz not null default now(),
  check ((status='draft' and revision=0) or (status<>'draft' and revision>=1))
);
create index competitions_season_idx on public.competitions(season_id);
create index competitions_creator_idx on public.competitions(created_by);
create table public.competition_rosters (
  competition_id uuid not null references public.competitions(id),
  team_id uuid not null references public.teams(id),
  season_roster_id uuid not null references public.team_season_rosters(id),
  primary key(competition_id,team_id)
);
create index competition_rosters_team_idx on public.competition_rosters(team_id);
create index competition_rosters_snapshot_idx on public.competition_rosters(season_roster_id);
create table public.competition_fixtures (
  id uuid primary key,
  competition_id uuid not null references public.competitions(id),
  ordinal integer not null check (ordinal>=0),
  round_id text not null,
  match_input jsonb not null,
  unique(competition_id,ordinal)
);
create table public.match_proposals (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null unique references public.competition_fixtures(id),
  result jsonb not null,
  result_sha256 text not null,
  generated_by uuid not null references public.app_users(user_id),
  created_at timestamptz not null default now()
);
create index match_proposals_actor_idx on public.match_proposals(generated_by);
create table public.match_results (
  fixture_id uuid primary key references public.competition_fixtures(id),
  proposal_id uuid not null unique references public.match_proposals(id),
  accepted_by uuid not null references public.app_users(user_id),
  accepted_at timestamptz not null default now()
);
create index match_results_actor_idx on public.match_results(accepted_by);
create table public.competition_audit (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id),
  actor_id uuid not null references public.app_users(user_id),
  action text not null check (action in ('created','activated','proposed','accepted')),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index competition_audit_competition_idx on public.competition_audit(competition_id);
create index competition_audit_actor_idx on public.competition_audit(actor_id);

-- No public write API, even for a browser with a commissioner session.
do $$ declare t text; begin
  foreach t in array array['competitions','competition_rosters','competition_fixtures','match_proposals','match_results','competition_audit'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant select,insert,update on public.%I to service_role',t);
    execute format('create policy registered_read on public.%I for select to authenticated using (exists (select 1 from public.app_users u where u.user_id=(select auth.uid())))',t);
  end loop;
end $$;

create function private.competition_immutable_v1() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
  raise exception 'Pinned competition records are immutable';
end $$;
revoke all on function private.competition_immutable_v1() from public,anon,authenticated;
grant execute on function private.competition_immutable_v1() to service_role;
create trigger competition_definition_immutable before update of id,season_id,competition_category,classification,name,definition,definition_sha256,created_by,created_at on public.competitions for each row execute function private.competition_immutable_v1();
create trigger competition_rosters_immutable before update or delete on public.competition_rosters for each row execute function private.competition_immutable_v1();
create trigger competition_fixtures_immutable before update or delete on public.competition_fixtures for each row execute function private.competition_immutable_v1();
create trigger match_proposals_immutable before update or delete on public.match_proposals for each row execute function private.competition_immutable_v1();
create trigger match_results_immutable before update or delete on public.match_results for each row execute function private.competition_immutable_v1();
create trigger competition_audit_immutable before update or delete on public.competition_audit for each row execute function private.competition_immutable_v1();

create function private.require_match_commissioner_v1(p_actor uuid) returns void
language plpgsql security invoker set search_path='' as $$ begin
  -- A backend supplies the actor only after Auth.getUser verifies its bearer token.
  if not exists(select 1 from public.app_users where user_id=p_actor and role='commissioner' for share) then
    raise exception 'Commissioner access required' using errcode='42501';
  end if;
end $$;
revoke all on function private.require_match_commissioner_v1(uuid) from public,anon,authenticated;
grant execute on function private.require_match_commissioner_v1(uuid) to service_role;

create function public.create_exhibition_competition_v1(p_actor uuid,p_season_id uuid,p_definition jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.competitions; s public.seasons; t jsonb; f jsonb; r public.team_season_rosters; v_input jsonb; i integer:=0; seen text[]:='{}'; k text; tid text; begin
  perform private.require_match_commissioner_v1(p_actor);
  select * into s from public.seasons where id=p_season_id for share;
  if not found or s.status='complete' then raise exception 'Available season required'; end if;
  if p_definition->>'classification' is distinct from 'exhibition' or p_definition ? 'standingsPolicy' then
    raise exception 'Official format and standings policy are deferred; create an unranked exhibition';
  end if;
  if p_definition->>'category' is distinct from s.competition_category
    or p_definition->>'seasonKey' is distinct from to_char(s.starts_on,'YYYY-MM')
    or p_definition->>'engineVersion' is distinct from '0.1.0-exhibition'
    or p_definition->>'engineSourceSHA256' is distinct from '9513ba17bef8814027cc3408731f7d26db9c8ce8cd5a25f52c42175286db3521'
    or jsonb_typeof(p_definition->'teams') is distinct from 'array'
    or jsonb_typeof(p_definition->'fixtures') is distinct from 'array' then raise exception 'Invalid competition scope or engine identity'; end if;
  if jsonb_array_length(p_definition->'teams') not between 2 and 18 or jsonb_array_length(p_definition->'fixtures') not between 1 and 500 then raise exception 'Teams and explicit fixtures required'; end if;
  perform pg_advisory_xact_lock(hashtext('century-competition-create'),hashtext(p_definition->>'id'));
  select * into c from public.competitions where id=(p_definition->>'id')::uuid;
  if found then
    if c.season_id<>p_season_id or c.definition<>p_definition then raise exception 'Conflicting competition definition' using errcode='40001'; end if;
    return jsonb_build_object('id',c.id,'added',false,'revision',c.revision);
  end if;
  insert into public.competitions(id,season_id,competition_category,classification,name,definition,definition_sha256,created_by)
    values((p_definition->>'id')::uuid,p_season_id,s.competition_category,'exhibition',p_definition->>'name',p_definition,encode(sha256(convert_to(p_definition::text,'UTF8')),'hex'),p_actor) returning * into c;
  for t in select value from jsonb_array_elements(p_definition->'teams') loop
    select * into r from public.team_season_rosters where season_id=p_season_id and team_id=(t->>'id')::uuid for share;
    if not found or r.match_team<>t then raise exception 'Roster differs from canonical season snapshot'; end if;
    insert into public.competition_rosters values(c.id,r.team_id,r.id);
  end loop;
  for f in select value from jsonb_array_elements(p_definition->'fixtures') loop
    if coalesce(length(f->>'roundId'),0) not between 1 and 100 or coalesce(length(f->>'seed'),0) not between 1 and 200
      or jsonb_typeof(f->'teamIds') is distinct from 'array' then raise exception 'Invalid fixture'; end if;
    if jsonb_array_length(f->'teamIds')<>2 or f->'teamIds'->>0=f->'teamIds'->>1 then raise exception 'Two distinct fixture teams required'; end if;
    for tid in select value from jsonb_array_elements_text(f->'teamIds') loop
      if not exists(select 1 from public.competition_rosters where competition_id=c.id and team_id=tid::uuid) then raise exception 'Unknown fixture team'; end if;
      k:=jsonb_build_array(f->>'roundId',tid)::text;
      if k=any(seen) then raise exception 'Team appears twice in a round'; end if;
      seen:=array_append(seen,k);
    end loop;
    v_input:=jsonb_build_object('id',f->>'id','seed',f->>'seed','teams',(select jsonb_agg(snap.match_team order by ids.n) from jsonb_array_elements_text(f->'teamIds') with ordinality ids(id,n) join public.team_season_rosters snap on snap.team_id=ids.id::uuid and snap.season_id=p_season_id),'provenance',jsonb_build_object('competitionId',c.id,'seasonKey',p_definition->>'seasonKey','competitionCategory',c.competition_category,'classification','exhibition','engineSourceSHA256',p_definition->>'engineSourceSHA256'));
    if p_definition ? 'config' then v_input:=v_input||jsonb_build_object('config',p_definition->'config'); end if;
    insert into public.competition_fixtures values((f->>'id')::uuid,c.id,i,f->>'roundId',v_input); i:=i+1;
  end loop;
  insert into public.competition_audit(competition_id,actor_id,action) values(c.id,p_actor,'created');
  return jsonb_build_object('id',c.id,'added',true,'revision',0);
end $$;

create function public.activate_competition_v1(p_actor uuid,p_competition_id uuid,p_expected_revision integer) returns jsonb
language plpgsql security invoker set search_path='' as $$ declare c public.competitions; begin
  perform private.require_match_commissioner_v1(p_actor);
  select * into c from public.competitions where id=p_competition_id for update;
  if not found then raise exception 'Unknown competition'; end if;
  if c.status<>'draft' then return jsonb_build_object('id',c.id,'added',false,'revision',c.revision); end if;
  if p_expected_revision is distinct from c.revision then raise exception 'Stale competition revision' using errcode='40001'; end if;
  update public.competitions set status='active',revision=1 where id=c.id;
  insert into public.competition_audit(competition_id,actor_id,action) values(c.id,p_actor,'activated');
  return jsonb_build_object('id',c.id,'added',true,'revision',1);
end $$;

create function public.stage_match_proposal_v1(p_actor uuid,p_fixture_id uuid,p_result jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.competitions; f public.competition_fixtures; p public.match_proposals; win integer; side integer; begin
  perform private.require_match_commissioner_v1(p_actor);
  select * into f from public.competition_fixtures where id=p_fixture_id;
  if not found then raise exception 'Unknown fixture'; end if;
  select * into c from public.competitions where id=f.competition_id for update;
  select * into p from public.match_proposals where fixture_id=f.id;
  if found then
    if p.result<>p_result then raise exception 'Conflicting fixture proposal' using errcode='40001'; end if;
    return jsonb_build_object('id',p.id,'added',false,'sha256',p.result_sha256);
  end if;
  if c.status<>'active' then raise exception 'Competition is not active'; end if;
  if p_result->'input' is distinct from f.match_input or p_result->>'id' is distinct from f.id::text
    or p_result->>'engineVersion' is distinct from c.definition->>'engineVersion'
    or p_result->>'seed' is distinct from f.match_input->>'seed' or p_result->>'status' is distinct from 'complete'
    or p_result->>'winner' not in ('0','1') or not(p_result ? 'winner')
    or jsonb_typeof(p_result->'scores') is distinct from 'array'
    or jsonb_typeof(p_result->'events') is distinct from 'array'
    or jsonb_array_length(p_result->'quarters') is distinct from 4
    or jsonb_array_length(p_result->'players') is distinct from 70 then raise exception 'Proposal differs from pinned fixture or is incomplete'; end if;
  win:=(p_result->>'winner')::integer;
  if jsonb_array_length(p_result->'scores')<>2 or (p_result->'scores'->>win)::integer<>100
    or (p_result->'scores'->>(1-win))::integer not between 0 and 99 then raise exception 'Illegal final score'; end if;
  for side in 0..1 loop
    if (select sum((x->'stats'->>'points')::integer) from jsonb_array_elements(p_result->'players') x where (x->>'side')::integer=side) is distinct from (p_result->'scores'->>side)::bigint then raise exception 'Player score mismatch'; end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_result->'events') e where e->>'type'='score' and e->'data'->>'winning'='true' and e->>'side'=win::text and e->'data'->>'kind'='central_air')<>1 then raise exception 'Qualifying winning kick required'; end if;
  insert into public.match_proposals(fixture_id,result,result_sha256,generated_by) values(f.id,p_result,encode(sha256(convert_to(p_result::text,'UTF8')),'hex'),p_actor) returning * into p;
  insert into public.competition_audit(competition_id,actor_id,action,detail) values(c.id,p_actor,'proposed',jsonb_build_object('fixtureId',f.id,'proposalId',p.id,'sha256',p.result_sha256));
  return jsonb_build_object('id',p.id,'added',true,'sha256',p.result_sha256);
end $$;

create function public.accept_match_proposal_v1(p_actor uuid,p_proposal_id uuid,p_expected_revision integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.match_proposals; f public.competition_fixtures; c public.competitions; a public.match_results; done boolean; begin
  perform private.require_match_commissioner_v1(p_actor);
  select * into p from public.match_proposals where id=p_proposal_id;
  if not found then raise exception 'Unknown proposal'; end if;
  select * into f from public.competition_fixtures where id=p.fixture_id;
  select * into c from public.competitions where id=f.competition_id for update;
  select * into a from public.match_results where fixture_id=f.id;
  if found then
    if a.proposal_id<>p.id then raise exception 'Conflicting accepted result' using errcode='40001'; end if;
    return jsonb_build_object('id',p.id,'added',false,'revision',c.revision,'status',c.status,'acceptedAt',a.accepted_at);
  end if;
  if c.status<>'active' then raise exception 'Competition is not active'; end if;
  if c.revision is distinct from p_expected_revision then raise exception 'Stale competition revision' using errcode='40001'; end if;
  insert into public.match_results(fixture_id,proposal_id,accepted_by) values(f.id,p.id,p_actor) returning * into a;
  select not exists(select 1 from public.competition_fixtures cf left join public.match_results mr on mr.fixture_id=cf.id where cf.competition_id=c.id and mr.fixture_id is null) into done;
  update public.competitions set revision=revision+1,status=case when done then 'complete' else 'active' end where id=c.id;
  insert into public.competition_audit(competition_id,actor_id,action,detail) values(c.id,p_actor,'accepted',jsonb_build_object('fixtureId',f.id,'proposalId',p.id,'revision',c.revision+1));
  return jsonb_build_object('id',p.id,'added',true,'revision',c.revision+1,'status',case when done then 'complete' else 'active' end,'acceptedAt',a.accepted_at);
end $$;

revoke all on function public.create_exhibition_competition_v1(uuid,uuid,jsonb),public.activate_competition_v1(uuid,uuid,integer),public.stage_match_proposal_v1(uuid,uuid,jsonb),public.accept_match_proposal_v1(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.create_exhibition_competition_v1(uuid,uuid,jsonb),public.activate_competition_v1(uuid,uuid,integer),public.stage_match_proposal_v1(uuid,uuid,jsonb),public.accept_match_proposal_v1(uuid,uuid,integer) to service_role;

-- Small read models avoid downloading every event ledger to list a round or table.
create view public.competition_fixture_status with (security_invoker=true) as
select f.id,f.competition_id,f.ordinal,f.round_id,jsonb_build_array(jsonb_build_object('id',f.match_input->'teams'->0->>'id','name',f.match_input->'teams'->0->>'name'),jsonb_build_object('id',f.match_input->'teams'->1->>'id','name',f.match_input->'teams'->1->>'name')) as teams,p.id as proposal_id,p.result_sha256,
  p.result->'scores' as scores,p.result->>'winner' as winner,a.accepted_at,a.accepted_by
from public.competition_fixtures f left join public.match_proposals p on p.fixture_id=f.id left join public.match_results a on a.fixture_id=f.id;
create view public.competition_team_records with (security_invoker=true) as
select cr.competition_id,cr.team_id,t.name,
 count(a.fixture_id)::integer as played,
 count(a.fixture_id) filter(where (p.result->>'winner')::integer=side.n)::integer as wins,
 count(a.fixture_id) filter(where (p.result->>'winner')::integer<>side.n)::integer as losses,
 coalesce(sum((p.result->'scores'->>side.n)::integer) filter(where a.fixture_id is not null),0)::integer as points_for,
 coalesce(sum((p.result->'scores'->>(1-side.n))::integer) filter(where a.fixture_id is not null),0)::integer as points_against
from public.competition_rosters cr join public.teams t on t.id=cr.team_id
left join public.competition_fixtures f on f.competition_id=cr.competition_id and exists(select 1 from jsonb_array_elements(f.match_input->'teams') x where x->>'id'=cr.team_id::text)
left join lateral (select case when f.match_input->'teams'->0->>'id'=cr.team_id::text then 0 else 1 end as n) side on true
left join public.match_results a on a.fixture_id=f.id left join public.match_proposals p on p.id=a.proposal_id
group by cr.competition_id,cr.team_id,t.name;
revoke all on public.competition_fixture_status,public.competition_team_records from public,anon,authenticated;
grant select on public.competition_fixture_status,public.competition_team_records to authenticated,service_role;
