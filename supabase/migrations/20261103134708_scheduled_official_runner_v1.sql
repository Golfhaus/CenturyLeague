create function private.scheduled_official_now_v1() returns timestamptz language sql stable security invoker set search_path='' as $$ select now() $$;
-- Scoped, leased execution queue. Configuration, credentials and the clock are
-- installed separately after validation; this migration starts no match/job.
create table private.scheduled_official_control (
 singleton boolean primary key default true check(singleton),
 competition_id uuid not null unique references public.competitions(id),
 actor_id uuid not null references public.app_users(user_id),
 stream_id uuid not null references private.competition_operation_streams_candidate(id),
 enabled boolean not null default false,
 paused boolean not null default false,
 token_sha256 text not null check(token_sha256 ~ '^[a-f0-9]{64}$'),
 vault_secret_id uuid not null,
 endpoint_url text not null check(endpoint_url ~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/run-official-fixture$'),
 active_job uuid,lease_id uuid,lease_until timestamptz,
 last_dispatch_at timestamptz,last_claim_at timestamptz,last_finish_at timestamptz,
 completed_at timestamptz
);
create table private.scheduled_official_jobs (
 id uuid primary key default gen_random_uuid(),
 competition_id uuid not null references public.competitions(id),
 fixture_id uuid not null unique references public.competition_fixtures(id),
 match_code text not null,scheduled_for timestamptz not null,
 command_id uuid not null unique,
 status text not null default 'queued' check(status in ('queued','running','blocked','retry','accepted','failed','superseded')),
 attempts integer not null default 0,max_attempts integer not null default 3,
 next_attempt_at timestamptz not null default private.scheduled_official_now_v1(),
 last_code text,updated_at timestamptz not null default private.scheduled_official_now_v1()
);
create index scheduled_official_due_idx on private.scheduled_official_jobs(status,next_attempt_at,scheduled_for);
create table private.scheduled_official_audit (
 id uuid primary key default gen_random_uuid(),
 job_id uuid references private.scheduled_official_jobs(id),
 actor_id uuid not null references public.app_users(user_id),
 action text not null,detail jsonb not null default '{}',created_at timestamptz not null default private.scheduled_official_now_v1()
);
create index scheduled_official_audit_job_idx on private.scheduled_official_audit(job_id);
do $$ declare t text; begin
 foreach t in array array['scheduled_official_control','scheduled_official_jobs','scheduled_official_audit'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on private.%I to service_role',t);
 end loop;
end $$;
grant update(paused,active_job,lease_id,lease_until,last_claim_at,last_finish_at) on private.scheduled_official_control to service_role;
grant select,insert,update on private.scheduled_official_jobs to service_role;
grant select,insert on private.scheduled_official_audit to service_role;
create trigger immutable_scheduled_audit before update or delete on private.scheduled_official_audit for each row execute function private.competition_immutable_v1();

create function private.require_scheduled_token_v1(p_token text) returns void language plpgsql security invoker set search_path='' as $$ begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' or not exists(select 1 from private.scheduled_official_control where token_sha256=encode(sha256(convert_to(p_token,'UTF8')),'hex')) then
  raise exception 'Runner authentication required' using errcode='28000';
 end if;
end $$;
create function private.refresh_scheduled_official_jobs_v1() returns void language plpgsql security invoker set search_path='' as $$
declare c private.scheduled_official_control; rev integer; begin
 select * into c from private.scheduled_official_control;
 if not found or not c.enabled or c.paused or c.completed_at is not null then return; end if;
 if not exists(select 1 from public.competitions where id=c.competition_id and status='active') then return; end if;
 perform private.require_official_ready_v1('men');
 select revision into rev from private.competition_operation_streams_candidate where id=c.stream_id;
 perform public.advance_official_tournament_v1(c.actor_id,c.competition_id,rev);
 with recursive mapped as (
  select m.fixture_id, m.fixture_id root from private.official_fixture_metadata m where m.competition_id=c.competition_id and m.source_fixture_id is null
  union all select m.fixture_id,p.root from private.official_fixture_metadata m join mapped p on m.source_fixture_id=p.fixture_id
 ), slots as (select value s from public.competitions comp,jsonb_array_elements(comp.definition->'formatDecision'->'slots') where comp.id=c.competition_id)
 insert into private.scheduled_official_jobs(competition_id,fixture_id,match_code,scheduled_for,command_id)
 select c.competition_id,m.fixture_id,s->>'code',(s->>'startsAt')::timestamptz,md5(m.fixture_id::text||':scheduled-accept-v1')::uuid
 from mapped m join slots on private.inaugural_fixture_id_v1(c.competition_id,s->>'code')=m.root
 where (s->>'startsAt')::timestamptz<=private.scheduled_official_now_v1()
 and not exists(select 1 from private.official_fixture_metadata child where child.source_fixture_id=m.fixture_id)
 and not exists(select 1 from public.official_result_dispositions d where d.fixture_id=m.fixture_id)
 on conflict(fixture_id) do nothing;
end $$;

create function public.claim_scheduled_official_v1(p_token text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.scheduled_official_control; j private.scheduled_official_jobs; lease uuid; begin
 perform private.require_scheduled_token_v1(p_token);
 select * into c from private.scheduled_official_control for update;
 if not c.enabled or c.paused or c.completed_at is not null then return jsonb_build_object('status','paused'); end if;
 if c.lease_until>private.scheduled_official_now_v1() then return jsonb_build_object('status','busy'); end if;
 if c.active_job is not null then
  update private.scheduled_official_jobs set status=case when attempts>=max_attempts then 'failed' else 'retry' end,last_code='lease_expired',next_attempt_at=private.scheduled_official_now_v1(),updated_at=private.scheduled_official_now_v1() where id=c.active_job and status='running';
  insert into private.scheduled_official_audit(job_id,actor_id,action) values(c.active_job,c.actor_id,'lease-expired');
 end if;
 update private.scheduled_official_control set active_job=null,lease_id=null,lease_until=null;
 perform private.refresh_scheduled_official_jobs_v1();
 select * into j from private.scheduled_official_jobs where competition_id=c.competition_id and status in ('queued','retry','blocked') and next_attempt_at<=private.scheduled_official_now_v1() and scheduled_for<=private.scheduled_official_now_v1()
 order by scheduled_for,match_code for update skip locked limit 1;
 if not found then return jsonb_build_object('status','idle'); end if;
 lease:=gen_random_uuid();
 update private.scheduled_official_jobs set status='running',attempts=attempts+1,updated_at=private.scheduled_official_now_v1() where id=j.id;
 update private.scheduled_official_control set active_job=j.id,lease_id=lease,lease_until=private.scheduled_official_now_v1()+interval '180 seconds',last_claim_at=private.scheduled_official_now_v1();
 insert into private.scheduled_official_audit(job_id,actor_id,action,detail) values(j.id,c.actor_id,'claimed',jsonb_build_object('attempt',j.attempts+1,'lease',lease));
 return jsonb_build_object('status','claimed','jobId',j.id,'leaseId',lease,'competitionId',c.competition_id,'fixtureId',j.fixture_id,'actorId',c.actor_id,'commandId',j.command_id);
end $$;

-- The lease check and each sporting RPC share one transaction/lock. An expired
-- worker cannot pin, stage or accept after a successor has claimed its job.
create function public.scheduled_official_rpc_v1(p_token text,p_job uuid,p_lease uuid,p_rpc text,p_args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.scheduled_official_control; j private.scheduled_official_jobs; event_type text; result jsonb; begin
 perform private.require_scheduled_token_v1(p_token);
 select * into c from private.scheduled_official_control for share;
 if not c.enabled or c.paused or c.active_job is null or c.lease_id is null or c.lease_until is null or c.active_job is distinct from p_job or c.lease_id is distinct from p_lease or c.lease_until<=private.scheduled_official_now_v1() then raise exception 'Scheduled lease expired or paused' using errcode='40001'; end if;
 select * into j from private.scheduled_official_jobs where id=p_job;
 if j.id is null or j.status<>'running' or j.competition_id<>c.competition_id or p_args->>'p_actor' is distinct from c.actor_id::text then raise exception 'Invalid scheduled request scope'; end if;
 case p_rpc
 when 'read_official_competition_v1' then
  if p_args->>'p_id' is distinct from c.competition_id::text then raise exception 'Invalid scheduled competition'; end if;
  return public.read_official_competition_v1(c.actor_id,c.competition_id);
 when 'read_official_tournament_v1' then
  if p_args->>'p_competition' is distinct from c.competition_id::text then raise exception 'Invalid scheduled competition'; end if;
  return public.read_official_tournament_v1(c.actor_id,c.competition_id);
 when 'check_official_tournament_fixture_v1' then
  if p_args->>'p_fixture' is distinct from j.fixture_id::text then raise exception 'Invalid scheduled fixture'; end if;
  perform public.check_official_tournament_fixture_v1(c.actor_id,j.fixture_id);return null;
 when 'pin_official_input_v1' then
  if p_args->>'p_fixture' is distinct from j.fixture_id::text or p_args->>'p_stream' is distinct from c.stream_id::text then raise exception 'Invalid scheduled pin'; end if;
  return public.pin_official_input_v1(c.actor_id,c.stream_id,j.fixture_id,(p_args->>'p_revision')::integer,p_args->>'p_head',p_args->'p_input');
 when 'stage_operations_proposal_candidate_v1' then
  if p_args->>'p_stream_id' is distinct from c.stream_id::text or p_args->'p_result'->>'id' is distinct from j.fixture_id::text then raise exception 'Invalid scheduled proposal'; end if;
  return public.stage_operations_proposal_candidate_v1(c.actor_id,c.stream_id,(p_args->>'p_proposal_id')::uuid,p_args->'p_result');
 when 'read_operations_proposal_candidate_v1' then
  if p_args->>'p_stream_id' is distinct from c.stream_id::text or not exists(select 1 from private.competition_operation_proposals_candidate where stream_id=c.stream_id and id=(p_args->>'p_proposal_id')::uuid and fixture_id=j.fixture_id::text) then raise exception 'Invalid scheduled proposal scope'; end if;
  return public.read_operations_proposal_candidate_v1(c.actor_id,c.stream_id,(p_args->>'p_proposal_id')::uuid);
 when 'append_operation_candidate_v1' then
  event_type:=p_args->'p_event'->'operation'->>'type';
  if p_args->>'p_stream_id' is distinct from c.stream_id::text or event_type not in ('accept','attempt') or event_type is null then raise exception 'Scheduled runner cannot make commissioner decisions'; end if;
  if event_type='accept' and (p_args->'p_event'->>'id' is distinct from j.command_id::text or p_args->'p_event'->'accepted'->>'fixtureId' is distinct from j.fixture_id::text
   or p_args->'p_event'->'accepted'->>'competitionId' is distinct from c.competition_id::text) then raise exception 'Invalid scheduled acceptance'; end if;
  if event_type='attempt' and p_args->'p_event'->'operation'->'evidence'->>'fixtureId' is distinct from j.fixture_id::text then raise exception 'Invalid scheduled attempt'; end if;
  return public.append_operation_candidate_v1(c.actor_id,c.stream_id,(p_args->>'p_expected_revision')::integer,p_args->>'p_expected_head',p_args->'p_event');
 else raise exception 'RPC is not allowed for the scheduled runner';
 end case;
end $$;

create function public.finish_scheduled_official_v1(p_token text,p_job uuid,p_lease uuid,p_outcome text,p_code text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.scheduled_official_control; j private.scheduled_official_jobs; outcome text; begin
 perform private.require_scheduled_token_v1(p_token);
 select * into c from private.scheduled_official_control for update;
 if c.active_job is null or c.lease_id is null or c.lease_until is null or c.active_job is distinct from p_job or c.lease_id is distinct from p_lease or c.lease_until<=private.scheduled_official_now_v1() then raise exception 'Scheduled lease expired' using errcode='40001'; end if;
 select * into j from private.scheduled_official_jobs where id=p_job for update;
 if p_outcome not in ('accepted','blocked','failed','retry','superseded') or coalesce(length(p_code),0) not between 1 and 80 then raise exception 'Valid scheduled outcome required'; end if;
 -- An accepted event is authoritative even if the worker lost its successful reply.
 if exists(select 1 from public.official_result_dispositions where fixture_id=j.fixture_id and voided_by is null) then outcome:='accepted';
 elsif p_outcome='accepted' then raise exception 'No accepted source exists for scheduled completion';
 elsif p_outcome='retry' and j.attempts>=j.max_attempts then outcome:='failed';
 else outcome:=p_outcome; end if;
 update private.scheduled_official_jobs set status=outcome,last_code=p_code,next_attempt_at=private.scheduled_official_now_v1()+case when outcome='retry' then interval '2 minutes' else interval '1 minute' end,updated_at=private.scheduled_official_now_v1() where id=j.id;
 update private.scheduled_official_control set active_job=null,lease_id=null,lease_until=null,last_finish_at=private.scheduled_official_now_v1();
 insert into private.scheduled_official_audit(job_id,actor_id,action,detail) values(j.id,c.actor_id,'finished',jsonb_build_object('outcome',outcome,'code',p_code,'attempt',j.attempts));
 -- Enqueue the next invocation after this transaction commits. This function
 -- reads Vault as its owner and exposes neither that token nor the service key.
 perform private.dispatch_scheduled_official_v1();
 return jsonb_build_object('status',outcome);
end $$;

create function public.scheduled_official_status_v1(p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.scheduled_official_control; begin
 perform private.require_match_commissioner_v1(p_actor);select * into c from private.scheduled_official_control;
 if not found then return jsonb_build_object('configured',false); end if;
 return jsonb_build_object('configured',true,'enabled',c.enabled,'paused',c.paused,'competitionId',c.competition_id,'lastDispatchAt',c.last_dispatch_at,'lastClaimAt',c.last_claim_at,'lastFinishAt',c.last_finish_at,'completedAt',c.completed_at,'busy',c.lease_until>private.scheduled_official_now_v1(),
  'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'matchCode',match_code,'scheduledFor',scheduled_for,'status',status,'attempts',attempts,'nextAttemptAt',next_attempt_at,'code',last_code) order by scheduled_for,match_code) from private.scheduled_official_jobs where competition_id=c.competition_id),'[]'));
end $$;
create function public.control_scheduled_official_v1(p_actor uuid,p_paused boolean,p_reason text) returns jsonb language plpgsql security invoker set search_path='' as $$ begin
 perform private.require_match_commissioner_v1(p_actor);
 if p_paused is null or coalesce(length(trim(p_reason)),0) not between 10 and 1000 then raise exception 'Specific commissioner reason required'; end if;
 perform 1 from private.scheduled_official_control for update;
 update private.scheduled_official_control set paused=p_paused;
 insert into private.scheduled_official_audit(actor_id,action,detail) values(p_actor,case when p_paused then 'paused' else 'resumed' end,jsonb_build_object('reason',p_reason));
 if not p_paused then perform private.dispatch_scheduled_official_v1(); end if;
 return public.scheduled_official_status_v1(p_actor);
end $$;
create function public.retry_scheduled_official_v1(p_actor uuid,p_job uuid,p_reason text) returns jsonb language plpgsql security invoker set search_path='' as $$ begin
 perform private.require_match_commissioner_v1(p_actor);
 if coalesce(length(trim(p_reason)),0) not between 10 and 1000 then raise exception 'Specific retry reason required'; end if;
 perform 1 from private.scheduled_official_control for update;
 if not exists(select 1 from private.scheduled_official_jobs j join private.scheduled_official_control c on c.competition_id=j.competition_id where j.id=p_job and j.status in ('failed','blocked','retry')) then raise exception 'Only an unaccepted failed or paused match can be retried'; end if;
 update private.scheduled_official_jobs set status='queued',next_attempt_at=private.scheduled_official_now_v1(),max_attempts=attempts+3,last_code='manual_retry',updated_at=private.scheduled_official_now_v1() where id=p_job;
 insert into private.scheduled_official_audit(job_id,actor_id,action,detail) values(p_job,p_actor,'manual-retry',jsonb_build_object('reason',p_reason));
 perform private.dispatch_scheduled_official_v1();return jsonb_build_object('queued',true);
end $$;

-- Only this tiny, argument-free dispatcher needs owner rights to read Vault
-- and call pg_net. No arbitrary URL, body, credential or SQL is caller supplied.
create function private.dispatch_scheduled_official_v1() returns void language plpgsql security definer set search_path='' as $$
declare c private.scheduled_official_control; bearer text; request_id bigint; bracket jsonb; begin
 select * into c from private.scheduled_official_control for update;
 if not found or not c.enabled or c.paused or c.completed_at is not null or c.lease_until>private.scheduled_official_now_v1() then return; end if;
 if not exists(select 1 from public.competitions where id=c.competition_id and status='active') then return; end if;
 perform private.refresh_scheduled_official_jobs_v1();
 bracket:=public.read_official_tournament_v1(c.actor_id,c.competition_id);
 if (bracket->>'complete')::boolean then
  update private.scheduled_official_control set completed_at=private.scheduled_official_now_v1();
  if to_regclass('cron.job') is not null then perform cron.unschedule(jobid) from cron.job where jobname='century-inaugural-runner-v1'; end if;
  return;
 end if;
 if not exists(select 1 from private.scheduled_official_jobs where competition_id=c.competition_id and status in ('queued','retry','blocked') and scheduled_for<=private.scheduled_official_now_v1() and next_attempt_at<=private.scheduled_official_now_v1()) then return; end if;
 -- Prevent repeated clock ticks from flooding requests before the worker claims.
 if c.last_dispatch_at>private.scheduled_official_now_v1()-interval '10 seconds' and (c.last_finish_at is null or c.last_finish_at<=c.last_dispatch_at) then return; end if;
 select decrypted_secret into bearer from vault.decrypted_secrets where id=c.vault_secret_id;
 if bearer is null then raise exception 'Scheduled runner credential unavailable'; end if;
 select net.http_post(url:=c.endpoint_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||bearer),body:='{}'::jsonb,timeout_milliseconds:=120000) into request_id;
 update private.scheduled_official_control set last_dispatch_at=private.scheduled_official_now_v1();
end $$;

-- Backend-only RPCs, including all reads. Browsers must use manage-matches.
do $$ declare fn record; begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
 (n.nspname='private' and p.proname in ('scheduled_official_now_v1','require_scheduled_token_v1','refresh_scheduled_official_jobs_v1','dispatch_scheduled_official_v1')) or
 (n.nspname='public' and p.proname in ('claim_scheduled_official_v1','scheduled_official_rpc_v1','finish_scheduled_official_v1','scheduled_official_status_v1','control_scheduled_official_v1','retry_scheduled_official_v1')) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
  execute format('grant execute on function %s to service_role',fn.signature);
 end loop;
end $$;
