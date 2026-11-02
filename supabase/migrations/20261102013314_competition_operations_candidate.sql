-- Validation-only journal. No official acceptance RPC or live match endpoint uses
-- these streams until canonical input pinning/atomic result integration is ready.
create table private.competition_operation_streams_candidate (
  id uuid primary key,
  purpose text not null default 'validation' check (purpose='validation'),
  category text not null check(category in ('men','women')),
  policy jsonb not null,
  revision integer not null default 0 check(revision>=0),
  head_sha256 text not null default repeat('0',64),
  created_by uuid not null references public.app_users(user_id),
  created_at timestamptz not null default now()
);
create index operation_stream_candidate_actor_idx on private.competition_operation_streams_candidate(created_by);
create table private.competition_operation_proposals_candidate (
  stream_id uuid not null references private.competition_operation_streams_candidate(id),
  id uuid not null,
  fixture_id text not null,
  result jsonb not null,
  result_sha256 text not null,
  generated_by uuid not null references public.app_users(user_id),
  created_at timestamptz not null default now(),
  primary key(stream_id,id),
  unique(stream_id,fixture_id)
);
create index operation_proposal_candidate_actor_idx on private.competition_operation_proposals_candidate(generated_by);
create table private.competition_operation_events_candidate (
  stream_id uuid not null references private.competition_operation_streams_candidate(id),
  id uuid not null,
  revision integer not null check(revision>0),
  actor_id uuid not null references public.app_users(user_id),
  payload jsonb not null,
  previous_sha256 text not null,
  event_sha256 text not null,
  source_proposal_id uuid,
  created_at timestamptz not null default now(),
  primary key(stream_id,id),
  unique(stream_id,revision),
  unique(stream_id,source_proposal_id),
  foreign key(stream_id,source_proposal_id) references private.competition_operation_proposals_candidate(stream_id,id)
);
create index operation_event_candidate_actor_idx on private.competition_operation_events_candidate(actor_id);
alter table private.competition_operation_streams_candidate enable row level security;
alter table private.competition_operation_events_candidate enable row level security;
alter table private.competition_operation_proposals_candidate enable row level security;
revoke all on private.competition_operation_streams_candidate,private.competition_operation_events_candidate,private.competition_operation_proposals_candidate from public,anon,authenticated;
grant select,insert,update on private.competition_operation_streams_candidate to service_role;
grant select,insert on private.competition_operation_events_candidate to service_role;
grant select,insert on private.competition_operation_proposals_candidate to service_role;
create trigger operation_stream_candidate_immutable before update of id,purpose,category,policy,created_by,created_at or delete
  on private.competition_operation_streams_candidate for each row execute function private.competition_immutable_v1();
create trigger operation_event_candidate_immutable before update or delete
  on private.competition_operation_events_candidate for each row execute function private.competition_immutable_v1();
create trigger operation_proposal_candidate_immutable before update or delete
  on private.competition_operation_proposals_candidate for each row execute function private.competition_immutable_v1();

create function public.stage_operations_proposal_candidate_v1(p_actor uuid,p_stream_id uuid,p_proposal_id uuid,p_result jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s private.competition_operation_streams_candidate; p private.competition_operation_proposals_candidate; begin
  perform private.require_match_commissioner_v1(p_actor);
  select * into s from private.competition_operation_streams_candidate where id=p_stream_id for update;
  if not found then raise exception 'Unknown validation operations stream'; end if;
  select * into p from private.competition_operation_proposals_candidate where stream_id=s.id and (id=p_proposal_id or fixture_id=p_result->>'id');
  if found then
    if p.id<>p_proposal_id or p.result<>p_result then raise exception 'Conflicting saved proposal'; end if;
    return jsonb_build_object('id',p.id,'added',false,'sha256',p.result_sha256);
  end if;
  if p_result->>'engineVersion' is distinct from '0.2.0-availability-candidate' or p_result->>'status' is distinct from 'complete'
    or p_result->'input'->'provenance'->>'classification' is distinct from 'competitive'
    or p_result->'input'->'provenance'->>'competitionCategory' is distinct from s.category
    or jsonb_array_length(p_result->'players') is distinct from 70 or coalesce(length(p_result->>'id'),0)=0
    or p_result->>'id' is distinct from p_result->'input'->>'id' then raise exception 'Complete scoped candidate result required'; end if;
  if octet_length(p_result::text)>16777216 then raise exception 'Candidate proposal exceeds storage guard'; end if;
  insert into private.competition_operation_proposals_candidate(stream_id,id,fixture_id,result,result_sha256,generated_by)
    values(s.id,p_proposal_id,p_result->>'id',p_result,encode(sha256(convert_to(p_result::text,'UTF8')),'hex'),p_actor) returning * into p;
  return jsonb_build_object('id',p.id,'added',true,'sha256',p.result_sha256);
end $$;

create function public.read_operations_proposal_candidate_v1(p_actor uuid,p_stream_id uuid,p_proposal_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p private.competition_operation_proposals_candidate; begin
  perform private.require_match_commissioner_v1(p_actor);
  select * into p from private.competition_operation_proposals_candidate where stream_id=p_stream_id and id=p_proposal_id;
  if not found then raise exception 'Unknown saved candidate proposal'; end if;
  if p.result_sha256<>encode(sha256(convert_to(p.result::text,'UTF8')),'hex') then raise exception 'Saved proposal integrity failure'; end if;
  return jsonb_build_object('id',p.id,'sha256',p.result_sha256,'result',p.result);
end $$;

create function public.create_operations_candidate_v1(p_actor uuid,p_stream_id uuid,p_category text,p_policy jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s private.competition_operation_streams_candidate; begin
  perform private.require_match_commissioner_v1(p_actor);
  if p_category not in ('men','women') or p_category is null or jsonb_typeof(p_policy->'bands') is distinct from 'array'
    or coalesce(length(p_policy->>'id'),0)=0 then raise exception 'Category and versioned recovery policy required'; end if;
  insert into private.competition_operation_streams_candidate(id,category,policy,created_by) values(p_stream_id,p_category,p_policy,p_actor)
    on conflict(id) do nothing;
  select * into s from private.competition_operation_streams_candidate where id=p_stream_id for update;
  if s.category<>p_category or s.policy<>p_policy or s.created_by<>p_actor then raise exception 'Conflicting operations initialization'; end if;
  return jsonb_build_object('id',s.id,'purpose',s.purpose,'revision',s.revision,'headSHA256',s.head_sha256);
end $$;

create function public.append_operation_candidate_v1(p_actor uuid,p_stream_id uuid,p_expected_revision integer,p_expected_head text,p_event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s private.competition_operation_streams_candidate; e private.competition_operation_events_candidate; p private.competition_operation_proposals_candidate; h text; eid uuid; source_id uuid; begin
  perform private.require_match_commissioner_v1(p_actor);
  select * into s from private.competition_operation_streams_candidate where id=p_stream_id for update;
  if not found then raise exception 'Unknown validation operations stream'; end if;
  eid:=(p_event->>'id')::uuid;
  select * into e from private.competition_operation_events_candidate where stream_id=s.id and id=eid;
  if found then
    if e.payload<>p_event or e.actor_id<>p_actor then raise exception 'Conflicting operations retry'; end if;
    return jsonb_build_object('id',e.id,'added',false,'revision',e.revision,'sha256',e.event_sha256);
  end if;
  if p_expected_revision is distinct from s.revision or p_expected_head is distinct from s.head_sha256 then
    raise exception 'Stale operations revision/head' using errcode='40001'; end if;
  if p_event->>'actor' is distinct from p_actor::text or (p_event->>'revision')::integer is distinct from s.revision+1
    or coalesce(length(p_event->>'request'),0)=0 or p_event->>'at' is null or
    p_event->'operation'->>'type' not in ('accept','discipline','correct','resolve-review','close','reopen','attempt') or
    p_event->'operation'->>'type' is null then raise exception 'Invalid backend operations event'; end if;
  if octet_length(p_event::text)>262144 then raise exception 'Store compact evidence; raw match ledgers belong in immutable proposals'; end if;
  if p_event->'operation'->>'type'='accept' then
    source_id:=(p_event->'operation'->>'proposalId')::uuid;
    select * into p from private.competition_operation_proposals_candidate where stream_id=s.id and id=source_id;
    if not found or p_event->'accepted'->>'proposalId' is distinct from p.id::text
      or p_event->'accepted'->>'resultSHA256' is distinct from p.result_sha256
      or p_event->'operation'->>'resultSHA256' is distinct from p.result_sha256
      or p_event->'accepted'->>'fixtureId' is distinct from p.fixture_id then raise exception 'Saved proposal reference/digest mismatch'; end if;
  end if;
  h:=encode(sha256(convert_to(s.head_sha256||p_event::text,'UTF8')),'hex');
  insert into private.competition_operation_events_candidate(stream_id,id,revision,actor_id,payload,previous_sha256,event_sha256,source_proposal_id)
    values(s.id,eid,s.revision+1,p_actor,p_event,s.head_sha256,h,source_id);
  update private.competition_operation_streams_candidate set revision=s.revision+1,head_sha256=h where id=s.id;
  return jsonb_build_object('id',eid,'added',true,'revision',s.revision+1,'sha256',h);
end $$;

create function public.read_operations_candidate_v1(p_actor uuid,p_stream_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s private.competition_operation_streams_candidate; begin
  perform private.require_match_commissioner_v1(p_actor);
  -- Share lock prevents observing a stream head and events from different commits.
  select * into s from private.competition_operation_streams_candidate where id=p_stream_id for share;
  if not found then raise exception 'Unknown validation operations stream'; end if;
  if (select count(*) from private.competition_operation_events_candidate where stream_id=s.id)<>s.revision or
    exists(select 1 from (select e.*,lag(e.event_sha256,1,repeat('0',64)) over(order by e.revision) expected_parent,
      row_number() over(order by e.revision) expected_revision from private.competition_operation_events_candidate e where e.stream_id=s.id) q
      where q.revision<>q.expected_revision or q.previous_sha256<>q.expected_parent or
        q.event_sha256<>encode(sha256(convert_to(q.previous_sha256||q.payload::text,'UTF8')),'hex')) or
    s.head_sha256<>coalesce((select event_sha256 from private.competition_operation_events_candidate where stream_id=s.id order by revision desc limit 1),repeat('0',64)) then
    raise exception 'Operations journal integrity failure'; end if;
  return jsonb_build_object('purpose',s.purpose,'headSHA256',s.head_sha256,'state',jsonb_build_object(
    'schemaVersion','century-operations-v1-candidate','category',s.category,'policy',s.policy,'revision',s.revision,
    'events',coalesce((select jsonb_agg(payload order by revision) from private.competition_operation_events_candidate where stream_id=s.id),'[]'::jsonb)));
end $$;
revoke all on function public.create_operations_candidate_v1(uuid,uuid,text,jsonb),
  public.append_operation_candidate_v1(uuid,uuid,integer,text,jsonb),public.read_operations_candidate_v1(uuid,uuid),
  public.stage_operations_proposal_candidate_v1(uuid,uuid,uuid,jsonb),public.read_operations_proposal_candidate_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_operations_candidate_v1(uuid,uuid,text,jsonb),
  public.append_operation_candidate_v1(uuid,uuid,integer,text,jsonb),public.read_operations_candidate_v1(uuid,uuid),
  public.stage_operations_proposal_candidate_v1(uuid,uuid,uuid,jsonb),public.read_operations_proposal_candidate_v1(uuid,uuid,uuid) to service_role;
