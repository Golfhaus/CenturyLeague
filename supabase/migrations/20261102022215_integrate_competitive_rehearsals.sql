-- Integrated commissioner rehearsals, deliberately outside official competitions.
create table private.competitive_rehearsals (
 id uuid primary key references private.competition_operation_streams_candidate(id),
 name text not null check(length(name) between 1 and 160),
 definition jsonb not null,
 created_by uuid not null references public.app_users(user_id),
 created_at timestamptz not null default now()
);
create index competitive_rehearsals_actor_idx on private.competitive_rehearsals(created_by);
create table private.competitive_rehearsal_fixtures (
 id uuid primary key,
 stream_id uuid not null references private.competitive_rehearsals(id),
 season_id uuid not null references public.seasons(id),
 round_id text not null check(length(round_id) between 1 and 100),
 match_date date not null,
 match_input jsonb not null,
 source_fixture_id uuid unique references private.competitive_rehearsal_fixtures(id),
 replaces_result_id uuid,
 reason text,
 created_at timestamptz not null default now(),
 unique(stream_id,id),
 foreign key(stream_id,replaces_result_id) references private.competition_operation_events_candidate(stream_id,id)
);
create index rehearsal_fixtures_stream_idx on private.competitive_rehearsal_fixtures(stream_id);
create index rehearsal_fixtures_season_idx on private.competitive_rehearsal_fixtures(season_id);
create index rehearsal_fixtures_replacement_idx on private.competitive_rehearsal_fixtures(stream_id,replaces_result_id);
create table private.competitive_rehearsal_rosters (
 fixture_id uuid not null references private.competitive_rehearsal_fixtures(id),
 team_id uuid not null references public.teams(id),
 snapshot_id uuid not null references public.team_season_rosters(id),
 primary key(fixture_id,team_id)
);
create index rehearsal_rosters_team_idx on private.competitive_rehearsal_rosters(team_id);
create index rehearsal_rosters_snapshot_idx on private.competitive_rehearsal_rosters(snapshot_id);
create table private.competitive_rehearsal_inputs (
 fixture_id uuid primary key references private.competitive_rehearsal_fixtures(id),
 match_input jsonb not null,
 input_sha256 text not null,
 pinned_by uuid not null references public.app_users(user_id),
 created_at timestamptz not null default now()
);
create index rehearsal_inputs_actor_idx on private.competitive_rehearsal_inputs(pinned_by);
create table private.competitive_rehearsal_results (
 fixture_id uuid primary key references private.competitive_rehearsal_fixtures(id),
 stream_id uuid not null,
 proposal_id uuid not null,
 accepted_event_id uuid not null,
 accepted_by uuid not null references public.app_users(user_id),
 accepted_at timestamptz not null default now(),
 unique(stream_id,proposal_id),
 unique(stream_id,accepted_event_id),
 foreign key(stream_id,fixture_id) references private.competitive_rehearsal_fixtures(stream_id,id),
 foreign key(stream_id,proposal_id) references private.competition_operation_proposals_candidate(stream_id,id),
 foreign key(stream_id,accepted_event_id) references private.competition_operation_events_candidate(stream_id,id)
);
create index rehearsal_results_actor_idx on private.competitive_rehearsal_results(accepted_by);
create index rehearsal_results_fixture_idx on private.competitive_rehearsal_results(stream_id,fixture_id);
create table private.competitive_rehearsal_audit (
 id uuid primary key default gen_random_uuid(),
 stream_id uuid not null references private.competitive_rehearsals(id),
 actor_id uuid not null references public.app_users(user_id),
 action text not null check(action in ('created','repinned','replacement')),
 detail jsonb not null,
 created_at timestamptz not null default now()
);
create index rehearsal_audit_stream_idx on private.competitive_rehearsal_audit(stream_id);
create index rehearsal_audit_actor_idx on private.competitive_rehearsal_audit(actor_id);
do $$ declare t text; begin
 foreach t in array array['competitive_rehearsals','competitive_rehearsal_fixtures','competitive_rehearsal_rosters','competitive_rehearsal_inputs','competitive_rehearsal_results','competitive_rehearsal_audit'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated',t);
  execute format('grant select,insert on private.%I to service_role',t);
  execute format('create trigger immutable before update or delete on private.%I for each row execute function private.competition_immutable_v1()',t);
 end loop;
end $$;

create function private.insert_rehearsal_fixture_v1(p_stream uuid,p_fixture jsonb,p_seed text,p_source_sha text,p_source uuid default null,p_replaces uuid default null,p_reason text default null) returns void
language plpgsql security invoker set search_path='' as $$
declare s public.seasons; v_category text; teams jsonb; snap public.team_season_rosters; tid text; input jsonb; date_value date; begin
 select category into v_category from private.competition_operation_streams_candidate where id=p_stream;
 select * into s from public.seasons where id=(p_fixture->>'seasonId')::uuid for share;
 if not found or s.status='complete' or s.competition_category<>v_category then raise exception 'Available season in the rehearsal category required'; end if;
 if coalesce(length(p_fixture->>'roundId'),0) not between 1 and 100 or p_fixture->>'matchDate' !~ '^\d{4}-\d{2}-\d{2}$'
  or jsonb_typeof(p_fixture->'teamIds') is distinct from 'array' then raise exception 'Round, date and two canonical teams required'; end if;
 date_value:=(p_fixture->>'matchDate')::date;
 if to_char(date_value,'YYYY-MM-DD')<>p_fixture->>'matchDate' or date_value<s.starts_on or date_value>=(s.starts_on+interval '1 month')::date then raise exception 'Fixture date must belong to its monthly season'; end if;
 if jsonb_array_length(p_fixture->'teamIds')<>2 or p_fixture->'teamIds'->>0=p_fixture->'teamIds'->>1 then raise exception 'Two different canonical teams required'; end if;
 select jsonb_agg(r.match_team order by ids.n) into teams from jsonb_array_elements_text(p_fixture->'teamIds') with ordinality ids(id,n)
  join public.team_season_rosters r on r.team_id=ids.id::uuid and r.season_id=s.id;
 if jsonb_array_length(teams) is distinct from 2 or exists(select 1 from jsonb_array_elements(teams) t where jsonb_array_length(t->'players') is distinct from 35) then raise exception 'Two complete canonical season rosters required'; end if;
 input:=jsonb_build_object('id',p_fixture->>'id','seed',p_seed,'teams',teams,'provenance',jsonb_build_object('competitionId',p_stream,
  'seasonKey',to_char(s.starts_on,'YYYY-MM'),'competitionCategory',v_category,'classification','competitive','purpose','validation','engineSourceSHA256',p_source_sha));
 insert into private.competitive_rehearsal_fixtures(id,stream_id,season_id,round_id,match_date,match_input,source_fixture_id,replaces_result_id,reason)
  values((p_fixture->>'id')::uuid,p_stream,s.id,p_fixture->>'roundId',date_value,input,p_source,p_replaces,p_reason);
 for tid in select value from jsonb_array_elements_text(p_fixture->'teamIds') loop
  select * into snap from public.team_season_rosters where season_id=s.id and team_id=tid::uuid;
  insert into private.competitive_rehearsal_rosters values((p_fixture->>'id')::uuid,tid::uuid,snap.id);
 end loop;
end $$;

create function public.create_competitive_rehearsal_v1(p_actor uuid,p_id uuid,p_name text,p_fixtures jsonb,p_policy jsonb,p_source_sha text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.competitive_rehearsals; c text; f jsonb; definition jsonb; begin
 perform private.require_match_commissioner_v1(p_actor);
 if length(trim(p_name)) not between 1 and 160 or p_name is null or jsonb_typeof(p_fixtures) is distinct from 'array' or jsonb_array_length(p_fixtures) not between 1 and 32 or p_source_sha !~ '^[a-f0-9]{64}$' then raise exception 'Name, explicit fixtures and source identity required'; end if;
 definition:=jsonb_build_object('name',trim(p_name),'fixtures',p_fixtures,'policy',p_policy,'sourceSHA256',p_source_sha);
 select * into r from private.competitive_rehearsals where id=p_id;
 if found then
  if r.definition<>definition or r.created_by<>p_actor then raise exception 'Conflicting rehearsal initialization'; end if;
  return jsonb_build_object('id',p_id,'added',false);
 end if;
 select competition_category into c from public.seasons where id=(p_fixtures->0->>'seasonId')::uuid;
 if not found then raise exception 'Unknown season'; end if;
 perform public.create_operations_candidate_v1(p_actor,p_id,c,p_policy);
 select * into r from private.competitive_rehearsals where id=p_id;
 if found then
  if r.definition<>definition or r.created_by<>p_actor then raise exception 'Conflicting rehearsal initialization'; end if;
  return jsonb_build_object('id',p_id,'added',false);
 end if;
 insert into private.competitive_rehearsals(id,name,definition,created_by) values(p_id,trim(p_name),definition,p_actor);
 for f in select value from jsonb_array_elements(p_fixtures) loop
  perform private.insert_rehearsal_fixture_v1(p_id,f,p_id::text||':'||(f->>'id'),p_source_sha);
 end loop;
 insert into private.competitive_rehearsal_audit(stream_id,actor_id,action,detail) values(p_id,p_actor,'created',definition);
 return jsonb_build_object('id',p_id,'added',true);
end $$;

create function public.list_competitive_rehearsals_v1(p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$ begin
 perform private.require_match_commissioner_v1(p_actor);
 return coalesce((select jsonb_agg(to_jsonb(q)) from(select r.id,r.name,s.category,r.created_at from private.competitive_rehearsals r
  join private.competition_operation_streams_candidate s on s.id=r.id order by r.created_at desc limit 100) q),'[]'::jsonb);
end $$;
create function public.read_competitive_rehearsal_v1(p_actor uuid,p_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare operations jsonb; r private.competitive_rehearsals; begin
 operations:=public.read_operations_candidate_v1(p_actor,p_id);
 select * into r from private.competitive_rehearsals where id=p_id;
 if not found then raise exception 'Unknown competitive rehearsal'; end if;
 return jsonb_build_object('id',r.id,'name',r.name,'operations',operations,'fixtures',coalesce((select jsonb_agg(to_jsonb(q) order by q.match_date,q.created_at,q.id) from(
  select f.*,p.id proposal_id,p.result_sha256,p.created_at proposed_at,a.accepted_event_id,a.accepted_at,i.match_input pinned_input,i.input_sha256
  from private.competitive_rehearsal_fixtures f left join private.competition_operation_proposals_candidate p on p.stream_id=f.stream_id and p.fixture_id=f.id::text
  left join private.competitive_rehearsal_results a on a.fixture_id=f.id left join private.competitive_rehearsal_inputs i on i.fixture_id=f.id where f.stream_id=p_id) q),'[]'::jsonb));
end $$;

create function public.pin_rehearsal_input_v1(p_actor uuid,p_stream uuid,p_fixture uuid,p_revision integer,p_head text,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s private.competition_operation_streams_candidate; f private.competitive_rehearsal_fixtures; i private.competitive_rehearsal_inputs; begin
 perform private.require_match_commissioner_v1(p_actor);
 select * into s from private.competition_operation_streams_candidate where id=p_stream for update;
 select * into f from private.competitive_rehearsal_fixtures where stream_id=p_stream and id=p_fixture;
 if not found then raise exception 'Unknown rehearsal fixture'; end if;
 select * into i from private.competitive_rehearsal_inputs where fixture_id=p_fixture;
 if found then return jsonb_build_object('input',i.match_input,'sha256',i.input_sha256,'added',false); end if;
 if s.revision is distinct from p_revision or s.head_sha256 is distinct from p_head then raise exception 'Stale operations revision/head' using errcode='40001'; end if;
 if (p_input-'availability') is distinct from f.match_input or p_input->'availability'->>'matchDate' is distinct from f.match_date::text
  or p_input->'availability'->>'replacesResultId' is distinct from f.replaces_result_id::text
  or exists(select 1 from private.competitive_rehearsal_fixtures where source_fixture_id=f.id) then raise exception 'Input differs from active pinned fixture'; end if;
 insert into private.competitive_rehearsal_inputs(fixture_id,match_input,input_sha256,pinned_by) values(f.id,p_input,encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),p_actor) returning * into i;
 return jsonb_build_object('input',i.match_input,'sha256',i.input_sha256,'added',true);
end $$;

-- Binding guards also protect direct backend RPC use; no event can be committed
-- without its result registration, and any registration failure rolls back it all.
create function private.bind_rehearsal_proposal_v1() returns trigger language plpgsql security invoker set search_path='' as $$
declare f private.competitive_rehearsal_fixtures; begin
 if exists(select 1 from private.competitive_rehearsals where id=new.stream_id) then
  select * into f from private.competitive_rehearsal_fixtures where stream_id=new.stream_id and id::text=new.fixture_id;
  if not found or ((new.result->'input')-'availability') is distinct from f.match_input or exists(select 1 from private.competitive_rehearsal_fixtures where source_fixture_id=f.id)
   or not exists(select 1 from private.competitive_rehearsal_inputs i where i.fixture_id=f.id and i.match_input=(new.result->'input')) then raise exception 'Proposal differs from pinned active canonical fixture'; end if;
  if new.result->'input'->'availability'->>'matchDate' is distinct from f.match_date::text or new.result->'input'->'availability'->>'replacesResultId' is distinct from f.replaces_result_id::text then raise exception 'Availability date/replacement scope differs'; end if;
 end if;
 return new;
end $$;
create trigger bind_rehearsal_proposal before insert on private.competition_operation_proposals_candidate for each row execute function private.bind_rehearsal_proposal_v1();
create function private.register_rehearsal_event_v1() returns trigger language plpgsql security invoker set search_path='' as $$
declare f private.competitive_rehearsal_fixtures; source private.competition_operation_events_candidate; begin
 if not exists(select 1 from private.competitive_rehearsals where id=new.stream_id) then return new; end if;
 if new.payload->'operation'->>'type'='accept' then
  select * into f from private.competitive_rehearsal_fixtures where stream_id=new.stream_id and id::text=new.payload->'accepted'->>'fixtureId';
  if not found or exists(select 1 from private.competitive_rehearsal_fixtures where source_fixture_id=f.id)
   or new.payload->'accepted'->>'competitionId' is distinct from new.stream_id::text
   or new.payload->'accepted'->>'matchDate' is distinct from f.match_date::text then raise exception 'Acceptance differs from active pinned fixture'; end if;
  insert into private.competitive_rehearsal_results(fixture_id,stream_id,proposal_id,accepted_event_id,accepted_by)
   values(f.id,new.stream_id,new.source_proposal_id,new.id,new.actor_id);
 elsif new.payload->'operation'->>'type'='close' then
  if exists(select 1 from private.competitive_rehearsal_fixtures cf where cf.stream_id=new.stream_id and not exists(select 1 from private.competitive_rehearsal_fixtures child where child.source_fixture_id=cf.id)
    and not exists(select 1 from private.competitive_rehearsal_results a where a.fixture_id=cf.id and not exists(select 1 from private.competition_operation_events_candidate e where e.stream_id=cf.stream_id and e.payload->'operation'->>'type'='correct' and e.payload->'operation'->>'resultId'=a.accepted_event_id::text))) then raise exception 'Pending or voided fixture prevents closure'; end if;
 end if;
 return new;
end $$;
create trigger register_rehearsal_event after insert on private.competition_operation_events_candidate for each row execute function private.register_rehearsal_event_v1();

create function public.replace_rehearsal_fixture_v1(p_actor uuid,p_stream uuid,p_source uuid,p_fixture jsonb,p_expected_revision integer,p_reason text,p_source_sha text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s private.competition_operation_streams_candidate; f private.competitive_rehearsal_fixtures; child private.competitive_rehearsal_fixtures; a private.competitive_rehearsal_results; rid uuid; begin
 perform private.require_match_commissioner_v1(p_actor);
 select * into s from private.competition_operation_streams_candidate where id=p_stream for update;
 if not found then raise exception 'Unknown rehearsal'; end if;
 select * into f from private.competitive_rehearsal_fixtures where id=p_source and stream_id=p_stream;
 if not found then raise exception 'Unknown source fixture'; end if;
 select * into child from private.competitive_rehearsal_fixtures where source_fixture_id=p_source;
 if found then
  if child.id<>(p_fixture->>'id')::uuid or child.reason is distinct from p_reason or child.season_id::text is distinct from p_fixture->>'seasonId'
   or child.round_id is distinct from p_fixture->>'roundId' or child.match_date::text is distinct from p_fixture->>'matchDate'
   or jsonb_build_array(child.match_input->'teams'->0->>'id',child.match_input->'teams'->1->>'id') is distinct from p_fixture->'teamIds'
   or child.match_input->'provenance'->>'engineSourceSHA256' is distinct from p_source_sha then raise exception 'Fixture already replaced; refresh'; end if;
  return jsonb_build_object('id',child.id,'added',false);
 end if;
 if s.revision is distinct from p_expected_revision then raise exception 'Stale operations revision' using errcode='40001'; end if;
 if coalesce(length(trim(p_reason)),0)<10 or length(p_reason)>1000 then raise exception 'Specific recorded reason required'; end if;
 if p_fixture->>'matchDate' is distinct from f.match_date::text then raise exception 'Replacement retains original date'; end if;
 select * into a from private.competitive_rehearsal_results where fixture_id=f.id;
 if found then
  if not exists(select 1 from private.competition_operation_events_candidate e where e.stream_id=p_stream and e.payload->'operation'->>'type'='correct' and e.payload->'operation'->>'resultId'=a.accepted_event_id::text) then raise exception 'Void accepted source before replacement'; end if;
  rid:=a.accepted_event_id;
 end if;
 if exists(select 1 from private.competition_operation_events_candidate e where e.stream_id=p_stream and e.payload->'operation'->>'type' in ('close','reopen') and e.revision=(select max(revision) from private.competition_operation_events_candidate x where x.stream_id=p_stream and x.payload->'operation'->>'type' in ('close','reopen')) and e.payload->'operation'->>'type'='close') then raise exception 'Explicit reopening required'; end if;
 perform private.insert_rehearsal_fixture_v1(p_stream,p_fixture,f.match_input->>'seed',p_source_sha,f.id,rid,p_reason);
 insert into private.competitive_rehearsal_audit(stream_id,actor_id,action,detail) values(p_stream,p_actor,case when rid is null then 'repinned' else 'replacement' end,jsonb_build_object('sourceFixtureId',p_source,'fixtureId',p_fixture->>'id','reason',p_reason));
 return jsonb_build_object('id',p_fixture->>'id','added',true);
end $$;

revoke all on function private.insert_rehearsal_fixture_v1(uuid,jsonb,text,text,uuid,uuid,text),private.bind_rehearsal_proposal_v1(),private.register_rehearsal_event_v1(),
 public.create_competitive_rehearsal_v1(uuid,uuid,text,jsonb,jsonb,text),public.list_competitive_rehearsals_v1(uuid),public.read_competitive_rehearsal_v1(uuid,uuid),public.replace_rehearsal_fixture_v1(uuid,uuid,uuid,jsonb,integer,text,text),public.pin_rehearsal_input_v1(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function private.insert_rehearsal_fixture_v1(uuid,jsonb,text,text,uuid,uuid,text),private.bind_rehearsal_proposal_v1(),private.register_rehearsal_event_v1(),
 public.create_competitive_rehearsal_v1(uuid,uuid,text,jsonb,jsonb,text),public.list_competitive_rehearsals_v1(uuid),public.read_competitive_rehearsal_v1(uuid,uuid),public.replace_rehearsal_fixture_v1(uuid,uuid,uuid,jsonb,integer,text,text),public.pin_rehearsal_input_v1(uuid,uuid,uuid,integer,text,jsonb) to service_role;
