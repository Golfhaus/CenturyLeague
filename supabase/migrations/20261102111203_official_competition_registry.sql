-- Official registry adapter. Both categories ship disabled, with no official
-- competition, journal or fixture created by this migration.
alter table private.competition_operation_streams_candidate drop constraint competition_operation_streams_candidate_purpose_check;
alter table private.competition_operation_streams_candidate add constraint competition_operation_streams_candidate_purpose_check check(purpose in ('validation','official'));

create table private.official_release_gates (
 category text primary key check(category in ('men','women')),
 policy_approved boolean not null default false,
 format_approved boolean not null default false,
 activation_enabled boolean not null default false,
 policy jsonb not null,
 engine_source_sha256 text not null,
 stream_id uuid unique references private.competition_operation_streams_candidate(id)
);
insert into private.official_release_gates(category,policy,engine_source_sha256)
 select category,'{"id":"recovery-calendar-v1-candidate","bands":[{"weight":80,"minimumDays":1,"maximumDays":3},{"weight":18,"minimumDays":4,"maximumDays":10},{"weight":2,"minimumDays":11,"maximumDays":28}]}'::jsonb,
 'c221b03cd89fb52ea13294a6686e47f9ded99a08f77b0c520fe5498657f58bc5' from unnest(array['men','women']) category;
alter table private.official_release_gates enable row level security;
revoke all on private.official_release_gates from public,anon,authenticated,service_role;
grant select,update(stream_id) on private.official_release_gates to service_role;
create function private.guard_official_stream_v1() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if old.stream_id is not null and new.stream_id is distinct from old.stream_id then raise exception 'A category journal cannot be reset'; end if;
 if new.stream_id is not null and not exists(select 1 from private.competition_operation_streams_candidate s where s.id=new.stream_id and s.category=new.category and s.purpose='official' and s.policy=new.policy) then raise exception 'Official category/policy journal required'; end if;
 return new;
end $$;
create trigger guard_official_stream before update on private.official_release_gates for each row execute function private.guard_official_stream_v1();

create table private.official_competition_bindings (
 competition_id uuid primary key references public.competitions(id),
 stream_id uuid not null references private.competition_operation_streams_candidate(id),
 unique(competition_id,stream_id)
);
create index official_bindings_stream_idx on private.official_competition_bindings(stream_id);
create table private.official_fixture_metadata (
 fixture_id uuid primary key references public.competition_fixtures(id),
 competition_id uuid not null,
 stream_id uuid not null,
 match_date date not null,
 source_fixture_id uuid unique references private.official_fixture_metadata(fixture_id),
 replaces_result_id uuid,
 reason text,
 foreign key(competition_id,stream_id) references private.official_competition_bindings(competition_id,stream_id),
 foreign key(stream_id,replaces_result_id) references private.competition_operation_events_candidate(stream_id,id)
);
create index official_fixtures_competition_idx on private.official_fixture_metadata(competition_id);
create index official_fixtures_stream_idx on private.official_fixture_metadata(stream_id);
create index official_fixtures_replaces_idx on private.official_fixture_metadata(stream_id,replaces_result_id);
create table private.official_fixture_inputs (
 fixture_id uuid primary key references private.official_fixture_metadata(fixture_id),
 match_input jsonb not null,
 input_sha256 text not null,
 pinned_by uuid not null references public.app_users(user_id),
 created_at timestamptz not null default now()
);
create index official_inputs_actor_idx on private.official_fixture_inputs(pinned_by);
create table public.official_result_dispositions (
 fixture_id uuid primary key references public.competition_fixtures(id),
 stream_id uuid not null,
 accepted_event_id uuid not null,
 voided_by uuid,
 foreign key(stream_id,accepted_event_id) references private.competition_operation_events_candidate(stream_id,id),
 foreign key(stream_id,voided_by) references private.competition_operation_events_candidate(stream_id,id),
 unique(stream_id,accepted_event_id)
);
create index official_dispositions_void_idx on public.official_result_dispositions(stream_id,voided_by);
do $$ declare t text; begin
 foreach t in array array['official_competition_bindings','official_fixture_metadata','official_fixture_inputs'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated',t);
  execute format('grant select,insert on private.%I to service_role',t);
  execute format('create trigger immutable before update or delete on private.%I for each row execute function private.competition_immutable_v1()',t);
 end loop;
end $$;
alter table public.official_result_dispositions enable row level security;
revoke all on public.official_result_dispositions from public,anon,authenticated;
grant select on public.official_result_dispositions to authenticated;
grant select,insert,update(voided_by) on public.official_result_dispositions to service_role;
create policy registered_read on public.official_result_dispositions for select to authenticated using(exists(select 1 from public.app_users u where u.user_id=(select auth.uid())));

create function private.require_official_ready_v1(p_category text) returns void language plpgsql security invoker set search_path='' as $$ begin
 if not exists(select 1 from private.official_release_gates where category=p_category and policy_approved and format_approved and activation_enabled for share) then
  raise exception 'Official competition disabled: recovery policy, format and release activation must be approved';
 end if;
end $$;
create function public.official_readiness_v1(p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$ begin
 perform private.require_match_commissioner_v1(p_actor);
 return (select jsonb_agg(jsonb_build_object('category',category,'policyApproved',policy_approved,'formatApproved',format_approved,'activationEnabled',activation_enabled,'hasJournal',stream_id is not null,'policy',policy) order by category) from private.official_release_gates);
end $$;

-- Keep the validation initializer from treating an official stream as a retry.
create or replace function public.create_operations_candidate_v1(p_actor uuid,p_stream_id uuid,p_category text,p_policy jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$ declare s private.competition_operation_streams_candidate; begin
 perform private.require_match_commissioner_v1(p_actor);
 if p_category not in ('men','women') or p_category is null or jsonb_typeof(p_policy->'bands') is distinct from 'array' or coalesce(length(p_policy->>'id'),0)=0 then raise exception 'Category and versioned recovery policy required'; end if;
 insert into private.competition_operation_streams_candidate(id,category,policy,created_by) values(p_stream_id,p_category,p_policy,p_actor) on conflict(id) do nothing;
 select * into s from private.competition_operation_streams_candidate where id=p_stream_id for update;
 if s.purpose<>'validation' or s.category<>p_category or s.policy<>p_policy or s.created_by<>p_actor then raise exception 'Conflicting validation operations initialization'; end if;
 return jsonb_build_object('id',s.id,'purpose',s.purpose,'revision',s.revision,'headSHA256',s.head_sha256);
end $$;

create function private.insert_official_fixture_v1(p_competition uuid,p_fixture jsonb,p_seed text,p_source uuid default null,p_replaces uuid default null,p_reason text default null) returns void
language plpgsql security invoker set search_path='' as $$
declare c public.competitions; s public.seasons; stream uuid; teams jsonb; date_value date; input jsonb; begin
 select * into c from public.competitions where id=p_competition;
 select * into s from public.seasons where id=c.season_id for share;
 select stream_id into stream from private.official_competition_bindings where competition_id=c.id;
 if stream is null or s.status='complete' or s.competition_category<>c.competition_category then raise exception 'Available canonical official season required'; end if;
 perform private.require_official_ready_v1(c.competition_category);
 if coalesce(length(p_fixture->>'roundId'),0) not between 1 and 100 or coalesce(p_fixture->>'matchDate','') !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(p_fixture->'teamIds') is distinct from 'array' then raise exception 'Explicit round/date/teams required'; end if;
 date_value:=(p_fixture->>'matchDate')::date;
 if to_char(date_value,'YYYY-MM-DD')<>p_fixture->>'matchDate' or date_value<s.starts_on or date_value>=(s.starts_on+interval '1 month')::date then raise exception 'Fixture date must belong to its monthly season'; end if;
 if jsonb_array_length(p_fixture->'teamIds')<>2 or p_fixture->'teamIds'->>0=p_fixture->'teamIds'->>1 then raise exception 'Two different canonical teams required'; end if;
 select jsonb_agg(r.match_team order by ids.n) into teams from jsonb_array_elements_text(p_fixture->'teamIds') with ordinality ids(id,n)
  join public.team_season_rosters r on r.team_id=ids.id::uuid and r.season_id=s.id;
 if jsonb_array_length(teams) is distinct from 2 or exists(select 1 from jsonb_array_elements(teams) t where jsonb_array_length(t->'players') is distinct from 35) then raise exception 'Two complete canonical season rosters required'; end if;
 input:=jsonb_build_object('id',p_fixture->>'id','seed',p_seed,'teams',teams,'provenance',jsonb_build_object('competitionId',c.id,'seasonKey',to_char(s.starts_on,'YYYY-MM'),'competitionCategory',c.competition_category,'classification','competitive','purpose','official','engineSourceSHA256',c.definition->>'engineSourceSHA256'));
 insert into public.competition_rosters(competition_id,team_id,season_roster_id)
  select c.id,r.team_id,r.id from public.team_season_rosters r where r.season_id=s.id and r.team_id in(select value::uuid from jsonb_array_elements_text(p_fixture->'teamIds')) on conflict do nothing;
 insert into public.competition_fixtures values((p_fixture->>'id')::uuid,c.id,(select coalesce(max(ordinal)+1,0) from public.competition_fixtures where competition_id=c.id),p_fixture->>'roundId',input);
 insert into private.official_fixture_metadata values((p_fixture->>'id')::uuid,c.id,stream,date_value,p_source,p_replaces,p_reason);
end $$;

create function public.create_official_competition_v1(p_actor uuid,p_id uuid,p_season uuid,p_name text,p_fixtures jsonb,p_format jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.seasons; g private.official_release_gates; c public.competitions; definition jsonb; f jsonb; begin
 perform private.require_match_commissioner_v1(p_actor);
 select * into s from public.seasons where id=p_season for share;
 if not found or s.status='complete' then raise exception 'Available season required'; end if;
 -- Serialize only the initializer; the category journal serializes sporting writes.
 perform pg_advisory_xact_lock(hashtext('century-official-create'),hashtext(s.competition_category));
 perform private.require_official_ready_v1(s.competition_category);
 select * into g from private.official_release_gates where category=s.competition_category;
 if coalesce(length(trim(p_name)),0) not between 1 and 160 or jsonb_typeof(p_fixtures) is distinct from 'array' or jsonb_array_length(p_fixtures) not between 1 and 500
  or jsonb_typeof(p_format) is distinct from 'object' or coalesce(length(trim(p_format->>'reference')),0)<10 then raise exception 'Name, explicit fixtures and recorded format decision required'; end if;
 definition:=jsonb_build_object('id',p_id,'name',trim(p_name),'seasonKey',to_char(s.starts_on,'YYYY-MM'),'category',s.competition_category,'classification','competitive','engineVersion','0.2.0-availability-candidate','engineSourceSHA256',g.engine_source_sha256,'fixtures',p_fixtures,'formatDecision',p_format,'recoveryPolicy',g.policy);
 select * into c from public.competitions where id=p_id;
 if found then
  if c.definition<>definition or c.season_id<>s.id or c.created_by<>p_actor then raise exception 'Conflicting official initialization'; end if;
  return jsonb_build_object('id',c.id,'added',false,'revision',c.revision);
 end if;
 if g.stream_id is null then
  g.stream_id:=gen_random_uuid();
  insert into private.competition_operation_streams_candidate(id,purpose,category,policy,created_by) values(g.stream_id,'official',g.category,g.policy,p_actor);
  update private.official_release_gates set stream_id=g.stream_id where category=g.category;
 end if;
 insert into public.competitions(id,season_id,competition_category,classification,name,definition,definition_sha256,created_by)
  values(p_id,s.id,s.competition_category,'competitive',trim(p_name),definition,encode(sha256(convert_to(definition::text,'UTF8')),'hex'),p_actor);
 insert into private.official_competition_bindings values(p_id,g.stream_id);
 for f in select value from jsonb_array_elements(p_fixtures) loop
  perform private.insert_official_fixture_v1(p_id,f,p_id::text||':'||(f->>'id'));
 end loop;
 insert into public.competition_audit(competition_id,actor_id,action,detail) values(p_id,p_actor,'created',jsonb_build_object('journalId',g.stream_id,'formatDecision',p_format));
 return jsonb_build_object('id',p_id,'added',true,'revision',0);
end $$;

create function public.list_official_competitions_v1(p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$ begin
 perform private.require_match_commissioner_v1(p_actor);
 return coalesce((select jsonb_agg(to_jsonb(q)) from(select c.id,c.name,c.status,c.competition_category,c.season_id from public.competitions c join private.official_competition_bindings b on b.competition_id=c.id order by c.created_at desc limit 100) q),'[]'::jsonb);
end $$;
create function public.read_official_competition_v1(p_actor uuid,p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.competitions; stream uuid; operations jsonb; begin
 perform private.require_match_commissioner_v1(p_actor);
 select stream_id into stream from private.official_competition_bindings where competition_id=p_id;
 if not found then raise exception 'Unknown official competition'; end if;
 operations:=public.read_operations_candidate_v1(p_actor,stream);
 select * into c from public.competitions where id=p_id;
 return jsonb_build_object('id',stream,'competitionId',c.id,'name',c.name,'status',c.status,'operations',operations,'fixtures',coalesce((select jsonb_agg(to_jsonb(q) order by q.match_date,q.ordinal) from(
  select f.id,m.stream_id,c.season_id,f.round_id,m.match_date,f.match_input,m.source_fixture_id,m.replaces_result_id,f.ordinal,
   p.id proposal_id,p.result_sha256,d.accepted_event_id,i.match_input pinned_input,i.input_sha256
  from public.competition_fixtures f join private.official_fixture_metadata m on m.fixture_id=f.id
  left join public.match_proposals p on p.fixture_id=f.id left join public.official_result_dispositions d on d.fixture_id=f.id
  left join private.official_fixture_inputs i on i.fixture_id=f.id where f.competition_id=c.id) q),'[]'::jsonb));
end $$;
create function public.pin_official_input_v1(p_actor uuid,p_stream uuid,p_fixture uuid,p_revision integer,p_head text,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s private.competition_operation_streams_candidate; m private.official_fixture_metadata; f public.competition_fixtures; i private.official_fixture_inputs; begin
 perform private.require_match_commissioner_v1(p_actor);
 select * into s from private.competition_operation_streams_candidate where id=p_stream for update;
 select * into m from private.official_fixture_metadata where fixture_id=p_fixture and stream_id=p_stream;
 if not found or s.purpose<>'official' then raise exception 'Unknown official fixture'; end if;
 perform private.require_official_ready_v1(s.category);
 if not exists(select 1 from public.competitions where id=m.competition_id and status='active') then raise exception 'Official competition is not active'; end if;
 select * into i from private.official_fixture_inputs where fixture_id=p_fixture;
 if found then return jsonb_build_object('input',i.match_input,'sha256',i.input_sha256,'added',false); end if;
 if s.revision is distinct from p_revision or s.head_sha256 is distinct from p_head then raise exception 'Stale category journal revision/head' using errcode='40001'; end if;
 select * into f from public.competition_fixtures where id=p_fixture;
 if p_input-'availability' is distinct from f.match_input or p_input->'availability'->>'matchDate' is distinct from m.match_date::text
  or p_input->'availability'->>'replacesResultId' is distinct from m.replaces_result_id::text or exists(select 1 from private.official_fixture_metadata where source_fixture_id=p_fixture) then raise exception 'Input differs from active official canonical fixture'; end if;
 insert into private.official_fixture_inputs(fixture_id,match_input,input_sha256,pinned_by) values(p_fixture,p_input,encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),p_actor) returning * into i;
 return jsonb_build_object('input',i.match_input,'sha256',i.input_sha256,'added',true);
end $$;

create function private.guard_official_competition_v1() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.classification='competitive' then
  perform private.require_official_ready_v1(new.competition_category);
  if tg_op='UPDATE' and new.status is distinct from old.status then
   if not exists(select 1 from private.official_competition_bindings where competition_id=new.id) then raise exception 'Official category binding required'; end if;
   if old.status<>'draft' and not exists(select 1 from private.competition_operation_events_candidate e join private.official_competition_bindings b on b.stream_id=e.stream_id
    where b.competition_id=new.id and e.payload->'operation'->>'competitionId'=new.id::text
     and e.payload->'operation'->>'type'=case when new.status='complete' then 'close' else 'reopen' end
     and e.revision=(select max(x.revision) from private.competition_operation_events_candidate x where x.stream_id=e.stream_id)) then raise exception 'Explicit official closure/reopening event required'; end if;
  end if;
 end if;
 return new;
end $$;
create trigger guard_official_competition before insert or update on public.competitions for each row execute function private.guard_official_competition_v1();

create function private.bind_official_proposal_v1() returns trigger language plpgsql security invoker set search_path='' as $$
declare m private.official_fixture_metadata; c public.competitions; begin
 if not exists(select 1 from private.competition_operation_streams_candidate where id=new.stream_id and purpose='official') then return new; end if;
 select * into m from private.official_fixture_metadata where stream_id=new.stream_id and fixture_id::text=new.fixture_id;
 if not found then raise exception 'Official proposal requires a canonical fixture'; end if;
 select * into c from public.competitions where id=m.competition_id;
 perform private.require_official_ready_v1(c.competition_category);
 if c.status<>'active' or exists(select 1 from private.official_fixture_metadata where source_fixture_id=m.fixture_id)
  or new.result->'input'->'provenance'->>'competitionId' is distinct from c.id::text
  or not exists(select 1 from private.official_fixture_inputs i where i.fixture_id=m.fixture_id and i.match_input=new.result->'input') then raise exception 'Official proposal differs from active pinned fixture'; end if;
 return new;
end $$;
create trigger bind_official_proposal before insert on private.competition_operation_proposals_candidate for each row execute function private.bind_official_proposal_v1();
create function private.mirror_official_proposal_v1() returns trigger language plpgsql security invoker set search_path='' as $$
declare comp uuid; begin
 select competition_id into comp from private.official_fixture_metadata where stream_id=new.stream_id and fixture_id::text=new.fixture_id;
 if found then
  insert into public.match_proposals(id,fixture_id,result,result_sha256,generated_by) values(new.id,new.fixture_id::uuid,new.result,new.result_sha256,new.generated_by);
  insert into public.competition_audit(competition_id,actor_id,action,detail) values(comp,new.generated_by,'proposed',jsonb_build_object('proposalId',new.id,'fixtureId',new.fixture_id,'sha256',new.result_sha256));
 end if;
 return new;
end $$;
create trigger mirror_official_proposal after insert on private.competition_operation_proposals_candidate for each row execute function private.mirror_official_proposal_v1();
create function private.guard_official_registration_v1() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if exists(select 1 from public.competition_fixtures f join public.competitions c on c.id=f.competition_id where f.id=new.fixture_id and c.classification='competitive') then
  if tg_table_name='match_proposals' then
   if not exists(select 1 from private.competition_operation_proposals_candidate p join private.official_fixture_metadata m on m.stream_id=p.stream_id and m.fixture_id::text=p.fixture_id
    where p.id=new.id and m.fixture_id=new.fixture_id and p.result=new.result and p.result_sha256=new.result_sha256 and p.generated_by=new.generated_by) then raise exception 'Official proposal must be saved through its category journal'; end if;
  else
   if not exists(select 1 from private.competition_operation_events_candidate e join private.official_fixture_metadata m on m.stream_id=e.stream_id
    where m.fixture_id=new.fixture_id and e.source_proposal_id=new.proposal_id and e.payload->'accepted'->>'fixtureId'=new.fixture_id::text and e.actor_id=new.accepted_by) then raise exception 'Official acceptance requires its atomic category event'; end if;
  end if;
 end if;
 return new;
end $$;
create trigger guard_official_proposal_registration before insert on public.match_proposals for each row execute function private.guard_official_registration_v1();
create trigger guard_official_result_registration before insert on public.match_results for each row execute function private.guard_official_registration_v1();

create function private.register_official_event_v1() returns trigger language plpgsql security invoker set search_path='' as $$
declare s private.competition_operation_streams_candidate; m private.official_fixture_metadata; c public.competitions; typ text:=new.payload->'operation'->>'type'; comp uuid; begin
 select * into s from private.competition_operation_streams_candidate where id=new.stream_id;
 if s.purpose<>'official' then return new; end if;
 perform private.require_official_ready_v1(s.category);
 if typ='accept' then
  select * into m from private.official_fixture_metadata where stream_id=s.id and fixture_id::text=new.payload->'accepted'->>'fixtureId';
  if not found then raise exception 'Unknown official accepted fixture'; end if;
  select * into c from public.competitions where id=m.competition_id for update;
  if c.status<>'active' or new.payload->'accepted'->>'competitionId' is distinct from c.id::text or new.payload->'operation'->>'competitionId' is distinct from c.id::text
   or new.payload->'accepted'->>'matchDate' is distinct from m.match_date::text or new.payload->'accepted'->>'replaces' is distinct from m.replaces_result_id::text
   or exists(select 1 from private.official_fixture_metadata where source_fixture_id=m.fixture_id) then raise exception 'Acceptance differs from active official fixture'; end if;
  insert into public.match_results(fixture_id,proposal_id,accepted_by) values(m.fixture_id,new.source_proposal_id,new.actor_id);
  insert into public.official_result_dispositions(fixture_id,stream_id,accepted_event_id) values(m.fixture_id,s.id,new.id);
  update public.competitions set revision=revision+1 where id=c.id;
  insert into public.competition_audit(competition_id,actor_id,action,detail) values(c.id,new.actor_id,'accepted',jsonb_build_object('fixtureId',m.fixture_id,'proposalId',new.source_proposal_id,'eventId',new.id,'journalRevision',new.revision));
 elsif typ='correct' then
  select f.* into m from private.official_fixture_metadata f join public.official_result_dispositions d on d.fixture_id=f.fixture_id where d.stream_id=s.id and d.accepted_event_id::text=new.payload->'operation'->>'resultId';
  if not found or not exists(select 1 from public.competitions where id=m.competition_id and status='active') then raise exception 'Open official source required for correction'; end if;
  update public.official_result_dispositions set voided_by=new.id where fixture_id=m.fixture_id;
 elsif typ in ('close','reopen') then
  comp:=(new.payload->'operation'->>'competitionId')::uuid;
  select * into c from public.competitions where id=comp and exists(select 1 from private.official_competition_bindings where competition_id=comp and stream_id=s.id) for update;
  if not found then raise exception 'Unknown official competition scope'; end if;
  if typ='close' and exists(select 1 from private.official_fixture_metadata f where f.competition_id=comp and not exists(select 1 from private.official_fixture_metadata child where child.source_fixture_id=f.fixture_id)
   and not exists(select 1 from public.official_result_dispositions d where d.fixture_id=f.fixture_id and d.voided_by is null)) then raise exception 'Pending or voided official fixture prevents closure'; end if;
  update public.competitions set status=case when typ='close' then 'complete' else 'active' end,revision=revision+1 where id=comp;
 end if;
 return new;
end $$;
create trigger register_official_event after insert on private.competition_operation_events_candidate for each row execute function private.register_official_event_v1();

create function private.guard_official_disposition_v1() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if tg_op='DELETE' then raise exception 'Official dispositions are retained'; end if;
 if tg_op='INSERT' and not exists(select 1 from private.competition_operation_events_candidate e join public.match_results a on a.fixture_id=new.fixture_id
  where e.stream_id=new.stream_id and e.id=new.accepted_event_id and e.payload->'accepted'->>'fixtureId'=new.fixture_id::text and e.source_proposal_id=a.proposal_id) then raise exception 'Atomic accepted source required'; end if;
 if tg_op='UPDATE' and (old.voided_by is not null or new.fixture_id is distinct from old.fixture_id or new.stream_id is distinct from old.stream_id or new.accepted_event_id is distinct from old.accepted_event_id) then raise exception 'Official source disposition cannot be rewritten'; end if;
 if new.voided_by is not null and not exists(select 1 from private.competition_operation_events_candidate e where e.stream_id=new.stream_id and e.id=new.voided_by and e.payload->'operation'->>'type'='correct' and e.payload->'operation'->>'resultId'=new.accepted_event_id::text) then raise exception 'Recorded correction required'; end if;
 return new;
end $$;
create trigger guard_official_disposition before insert or update or delete on public.official_result_dispositions for each row execute function private.guard_official_disposition_v1();

create function public.replace_official_fixture_v1(p_actor uuid,p_stream uuid,p_source uuid,p_fixture jsonb,p_expected_revision integer,p_reason text,p_source_sha text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s private.competition_operation_streams_candidate; m private.official_fixture_metadata; child private.official_fixture_metadata; f public.competition_fixtures; cf public.competition_fixtures; d public.official_result_dispositions; begin
 perform private.require_match_commissioner_v1(p_actor);
 select * into s from private.competition_operation_streams_candidate where id=p_stream for update;
 select * into m from private.official_fixture_metadata where fixture_id=p_source and stream_id=p_stream;
 if not found then raise exception 'Unknown official source fixture'; end if;
 perform private.require_official_ready_v1(s.category);
 select * into f from public.competition_fixtures where id=p_source;
 select * into child from private.official_fixture_metadata where source_fixture_id=p_source;
 if found then
  select * into cf from public.competition_fixtures where id=child.fixture_id;
  if child.fixture_id::text is distinct from p_fixture->>'id' or child.reason is distinct from p_reason or child.match_date::text is distinct from p_fixture->>'matchDate'
   or cf.round_id is distinct from p_fixture->>'roundId' or jsonb_build_array(cf.match_input->'teams'->0->>'id',cf.match_input->'teams'->1->>'id') is distinct from p_fixture->'teamIds'
   or cf.match_input->'provenance'->>'engineSourceSHA256' is distinct from p_source_sha then raise exception 'Conflicting official replacement retry'; end if;
  return jsonb_build_object('id',child.fixture_id,'added',false);
 end if;
 if s.revision is distinct from p_expected_revision then raise exception 'Stale category journal revision' using errcode='40001'; end if;
 if not exists(select 1 from public.competitions where id=m.competition_id and status='active' and definition->>'engineSourceSHA256'=p_source_sha and season_id::text=p_fixture->>'seasonId') then raise exception 'Active competition, original season and engine required'; end if;
 if coalesce(length(trim(p_reason)),0)<10 or length(p_reason)>1000 or p_fixture->>'matchDate' is distinct from m.match_date::text or p_fixture->>'roundId' is distinct from f.round_id then raise exception 'Specific reason and original date/round required'; end if;
 select * into d from public.official_result_dispositions where fixture_id=p_source;
 if found and d.voided_by is null then raise exception 'Void official source before replacement'; end if;
 perform private.insert_official_fixture_v1(m.competition_id,p_fixture,f.match_input->>'seed',p_source,d.accepted_event_id,p_reason);
 return jsonb_build_object('id',p_fixture->>'id','added',true);
end $$;

-- Immutable registrations remain visible for audit. Active records omit voided
-- sources, and superseded fixtures do not look like unfinished round matches.
create or replace view public.competition_fixture_status with(security_invoker=true) as
 select f.id,f.competition_id,f.ordinal,f.round_id,jsonb_build_array(jsonb_build_object('id',f.match_input->'teams'->0->>'id','name',f.match_input->'teams'->0->>'name'),jsonb_build_object('id',f.match_input->'teams'->1->>'id','name',f.match_input->'teams'->1->>'name')) teams,
 p.id proposal_id,p.result_sha256,p.result->'scores' scores,p.result->>'winner' winner,case when d.voided_by is null then a.accepted_at end accepted_at,a.accepted_by,d.voided_by
 from public.competition_fixtures f left join public.match_proposals p on p.fixture_id=f.id left join public.match_results a on a.fixture_id=f.id left join public.official_result_dispositions d on d.fixture_id=f.id;
create or replace view public.competition_team_records with(security_invoker=true) as
 select cr.competition_id,cr.team_id,t.name,count(a.fixture_id)::integer played,
 count(a.fixture_id) filter(where (p.result->>'winner')::integer=side.n)::integer wins,
 count(a.fixture_id) filter(where (p.result->>'winner')::integer<>side.n)::integer losses,
 coalesce(sum((p.result->'scores'->>side.n)::integer) filter(where a.fixture_id is not null),0)::integer points_for,
 coalesce(sum((p.result->'scores'->>(1-side.n))::integer) filter(where a.fixture_id is not null),0)::integer points_against
 from public.competition_rosters cr join public.teams t on t.id=cr.team_id
 left join public.competition_fixtures f on f.competition_id=cr.competition_id and exists(select 1 from jsonb_array_elements(f.match_input->'teams') x where x->>'id'=cr.team_id::text)
 left join lateral(select case when f.match_input->'teams'->0->>'id'=cr.team_id::text then 0 else 1 end n) side on true
 left join public.match_results a on a.fixture_id=f.id and not exists(select 1 from public.official_result_dispositions d where d.fixture_id=f.id and d.voided_by is not null)
 left join public.match_proposals p on p.id=a.proposal_id group by cr.competition_id,cr.team_id,t.name;

-- All functions remain backend-only, including readiness and read endpoints.
do $$ declare fn record; begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
  (n.nspname='private' and p.proname in ('guard_official_stream_v1','require_official_ready_v1','insert_official_fixture_v1','guard_official_competition_v1','bind_official_proposal_v1','mirror_official_proposal_v1','guard_official_registration_v1','register_official_event_v1','guard_official_disposition_v1')) or
  (n.nspname='public' and p.proname in ('official_readiness_v1','create_official_competition_v1','list_official_competitions_v1','read_official_competition_v1','pin_official_input_v1','replace_official_fixture_v1')) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
  execute format('grant execute on function %s to service_role',fn.signature);
 end loop;
end $$;
