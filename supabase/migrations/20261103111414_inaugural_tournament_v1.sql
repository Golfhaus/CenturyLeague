-- Dated 18-club bracket registration. Does not schedule jobs, activate play,
-- run simulations, or alter existing journals/results/gameplay fingerprints.
create function private.require_official_draft_ready_v1(p_category text) returns void
language plpgsql security invoker set search_path='' as $$ begin
 if not exists(select 1 from private.official_release_gates where category=p_category and policy_approved and format_approved for share) then
  raise exception 'Official competition disabled: approved recovery policy and format required';
 end if;
end $$;
create function private.inaugural_template_v1() returns jsonb language sql immutable security invoker set search_path='' as $template$
 select $json${"id":"inaugural-18-double-elimination-v1","reference":"Commissioner-approved 18-club double-elimination inaugural, November 2-3, 2026","startsOn":"2026-11-03","endsOn":"2026-12-04","timeZone":"America/New_York","rosterPolicy":"Frozen November 2026 entry rosters throughout inaugural","decemberDivisionalWindow":{"startsOn":"2026-12-08","endsOn":"2026-12-27"},"seeds":[{"seed":1,"name":"Erie City Rovers","wins":753,"losses":97},{"seed":2,"name":"Sporting Durham","wins":694,"losses":156},{"seed":3,"name":"Frederick Forge","wins":692,"losses":158},{"seed":4,"name":"Hampden Works CC","wins":642,"losses":208},{"seed":5,"name":"Sporting Brandywine","wins":634,"losses":216},{"seed":6,"name":"Asheville Highland","wins":568,"losses":282},{"seed":7,"name":"Roanoke Athletic","wins":509,"losses":341},{"seed":8,"name":"Hagerstown Albion","wins":447,"losses":403},{"seed":9,"name":"Anacostia United","wins":395,"losses":455},{"seed":10,"name":"Norfolk Maritime","wins":349,"losses":501},{"seed":11,"name":"Lynchburg Union","wins":339,"losses":511},{"seed":12,"name":"Greensboro Crescent CC","wins":327,"losses":523},{"seed":13,"name":"Philadelphia Northwest","wins":301,"losses":549},{"seed":14,"name":"Lancaster Red Rose CC","wins":280,"losses":570},{"seed":15,"name":"Dover Town CC","wins":269,"losses":581},{"seed":16,"name":"Silver Spring Athletic","wins":222,"losses":628},{"seed":17,"name":"Manchester Borough CC","wins":118,"losses":732},{"seed":18,"name":"Wilmington Cape CC","wins":111,"losses":739}],"slots":[{"code":"M01","stage":"Upper preliminary","window":1,"matchDate":"2026-11-03","startsAt":"2026-11-03T19:00:00-05:00","entrants":["S15","S18"]},{"code":"M02","stage":"Upper preliminary","window":1,"matchDate":"2026-11-03","startsAt":"2026-11-03T19:00:00-05:00","entrants":["S16","S17"]},{"code":"M03","stage":"Upper round of 16","window":1,"matchDate":"2026-11-03","startsAt":"2026-11-03T19:00:00-05:00","entrants":["S8","S9"]},{"code":"M04","stage":"Upper round of 16","window":1,"matchDate":"2026-11-03","startsAt":"2026-11-03T19:00:00-05:00","entrants":["S5","S12"]},{"code":"M05","stage":"Upper round of 16","window":1,"matchDate":"2026-11-03","startsAt":"2026-11-03T19:00:00-05:00","entrants":["S4","S13"]},{"code":"M06","stage":"Upper round of 16","window":1,"matchDate":"2026-11-03","startsAt":"2026-11-03T19:00:00-05:00","entrants":["S3","S14"]},{"code":"M07","stage":"Upper round of 16","window":1,"matchDate":"2026-11-03","startsAt":"2026-11-03T19:00:00-05:00","entrants":["S6","S11"]},{"code":"M08","stage":"Upper round of 16","window":1,"matchDate":"2026-11-03","startsAt":"2026-11-03T19:00:00-05:00","entrants":["S7","S10"]},{"code":"M09","stage":"Upper round of 16","window":2,"matchDate":"2026-11-06","startsAt":"2026-11-06T19:00:00-05:00","entrants":["S1","W:M02"]},{"code":"M10","stage":"Upper round of 16","window":2,"matchDate":"2026-11-06","startsAt":"2026-11-06T19:00:00-05:00","entrants":["S2","W:M01"]},{"code":"M11","stage":"Lower entry","window":2,"matchDate":"2026-11-06","startsAt":"2026-11-06T19:00:00-05:00","entrants":["L:M01","L:M03"]},{"code":"M12","stage":"Lower entry","window":2,"matchDate":"2026-11-06","startsAt":"2026-11-06T19:00:00-05:00","entrants":["L:M02","L:M08"]},{"code":"M13","stage":"Lower round 1","window":2,"matchDate":"2026-11-06","startsAt":"2026-11-06T19:00:00-05:00","entrants":["L:M04","L:M05"]},{"code":"M14","stage":"Lower round 1","window":2,"matchDate":"2026-11-06","startsAt":"2026-11-06T19:00:00-05:00","entrants":["L:M06","L:M07"]},{"code":"M15","stage":"Upper quarterfinals","window":3,"matchDate":"2026-11-10","startsAt":"2026-11-10T19:00:00-05:00","entrants":["W:M09","W:M03"]},{"code":"M16","stage":"Upper quarterfinals","window":3,"matchDate":"2026-11-10","startsAt":"2026-11-10T19:00:00-05:00","entrants":["W:M04","W:M05"]},{"code":"M17","stage":"Upper quarterfinals","window":3,"matchDate":"2026-11-10","startsAt":"2026-11-10T19:00:00-05:00","entrants":["W:M06","W:M07"]},{"code":"M18","stage":"Upper quarterfinals","window":3,"matchDate":"2026-11-10","startsAt":"2026-11-10T19:00:00-05:00","entrants":["W:M08","W:M10"]},{"code":"M19","stage":"Lower round 1","window":3,"matchDate":"2026-11-10","startsAt":"2026-11-10T19:00:00-05:00","entrants":["L:M09","W:M11"]},{"code":"M20","stage":"Lower round 1","window":3,"matchDate":"2026-11-10","startsAt":"2026-11-10T19:00:00-05:00","entrants":["L:M10","W:M12"]},{"code":"M21","stage":"Lower round 2","window":4,"matchDate":"2026-11-13","startsAt":"2026-11-13T19:00:00-05:00","entrants":["W:M19","L:M18"]},{"code":"M22","stage":"Lower round 2","window":4,"matchDate":"2026-11-13","startsAt":"2026-11-13T19:00:00-05:00","entrants":["W:M13","L:M17"]},{"code":"M23","stage":"Lower round 2","window":4,"matchDate":"2026-11-13","startsAt":"2026-11-13T19:00:00-05:00","entrants":["W:M14","L:M16"]},{"code":"M24","stage":"Lower round 2","window":4,"matchDate":"2026-11-13","startsAt":"2026-11-13T19:00:00-05:00","entrants":["W:M20","L:M15"]},{"code":"M25","stage":"Division placement","window":4,"matchDate":"2026-11-13","startsAt":"2026-11-13T19:00:00-05:00","entrants":["Best original seed among losers L1\u2013L4","Worst original seed among losers L1\u2013L4"],"pool":"A","ranks":[1,4]},{"code":"M26","stage":"Division placement","window":4,"matchDate":"2026-11-13","startsAt":"2026-11-13T19:00:00-05:00","entrants":["Second-best original seed among losers L1\u2013L4","Second-worst original seed among losers L1\u2013L4"],"pool":"A","ranks":[2,3]},{"code":"M27","stage":"Upper semifinals","window":5,"matchDate":"2026-11-17","startsAt":"2026-11-17T19:00:00-05:00","entrants":["W:M15","W:M16"]},{"code":"M28","stage":"Upper semifinals","window":5,"matchDate":"2026-11-17","startsAt":"2026-11-17T19:00:00-05:00","entrants":["W:M17","W:M18"]},{"code":"M29","stage":"Lower round 3","window":5,"matchDate":"2026-11-17","startsAt":"2026-11-17T19:00:00-05:00","entrants":["W:M21","W:M22"]},{"code":"M30","stage":"Lower round 3","window":5,"matchDate":"2026-11-17","startsAt":"2026-11-17T19:00:00-05:00","entrants":["W:M23","W:M24"]},{"code":"M31","stage":"Division placement","window":5,"matchDate":"2026-11-17","startsAt":"2026-11-17T19:00:00-05:00","entrants":["Best original seed among losers L5\u2013L8","Worst original seed among losers L5\u2013L8"],"pool":"B","ranks":[1,4]},{"code":"M32","stage":"Division placement","window":5,"matchDate":"2026-11-17","startsAt":"2026-11-17T19:00:00-05:00","entrants":["Second-best original seed among losers L5\u2013L8","Second-worst original seed among losers L5\u2013L8"],"pool":"B","ranks":[2,3]},{"code":"M33","stage":"Lower round 4","window":6,"matchDate":"2026-11-20","startsAt":"2026-11-20T19:00:00-05:00","entrants":["W:M29","L:M27"]},{"code":"M34","stage":"Lower round 4","window":6,"matchDate":"2026-11-20","startsAt":"2026-11-20T19:00:00-05:00","entrants":["W:M30","L:M28"]},{"code":"M35","stage":"Upper final","window":7,"matchDate":"2026-11-24","startsAt":"2026-11-24T19:00:00-05:00","entrants":["W:M27","W:M28"]},{"code":"M36","stage":"Lower semifinal","window":7,"matchDate":"2026-11-24","startsAt":"2026-11-24T19:00:00-05:00","entrants":["W:M33","W:M34"]},{"code":"M37","stage":"Lower final","window":8,"matchDate":"2026-11-27","startsAt":"2026-11-27T19:00:00-05:00","entrants":["W:M36","L:M35"]},{"code":"M38","stage":"Grand final","window":9,"matchDate":"2026-12-01","startsAt":"2026-12-01T19:00:00-05:00","entrants":["W:M35","W:M37"]},{"code":"M39","stage":"Grand final reset","window":10,"matchDate":"2026-12-04","startsAt":"2026-12-04T19:00:00-05:00","entrants":["W:M35","W:M37"],"conditional":true}]}$json$::jsonb;
$template$;
create or replace function private.insert_official_fixture_v1(p_competition uuid,p_fixture jsonb,p_seed text,p_source uuid default null,p_replaces uuid default null,p_reason text default null) returns void
language plpgsql security invoker set search_path='' as $$
declare c public.competitions; s public.seasons; stream uuid; teams jsonb; date_value date; input jsonb; begin
 select * into c from public.competitions where id=p_competition;
 select * into s from public.seasons where id=c.season_id for share;
 select stream_id into stream from private.official_competition_bindings where competition_id=c.id;
 if stream is null or s.status='complete' or s.competition_category<>c.competition_category then raise exception 'Available canonical official season required'; end if;
 if c.status='draft' then perform private.require_official_draft_ready_v1(c.competition_category);
 else perform private.require_official_ready_v1(c.competition_category); end if;
 if coalesce(length(p_fixture->>'roundId'),0) not between 1 and 100 or coalesce(p_fixture->>'matchDate','') !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(p_fixture->'teamIds') is distinct from 'array' then raise exception 'Explicit round/date/teams required'; end if;
 date_value:=(p_fixture->>'matchDate')::date;
 if to_char(date_value,'YYYY-MM-DD')<>p_fixture->>'matchDate' then raise exception 'Invalid fixture date'; end if;
 if c.definition->'formatDecision'->>'id'='inaugural-18-double-elimination-v1' then
  if date_value not between '2026-11-03'::date and '2026-12-04'::date then raise exception 'Fixture outside approved inaugural span'; end if;
 else
  if date_value<s.starts_on or date_value>=(s.starts_on+interval '1 month')::date then raise exception 'Fixture date must belong to its monthly season'; end if;
 end if;
 if jsonb_array_length(p_fixture->'teamIds')<>2 or p_fixture->'teamIds'->>0=p_fixture->'teamIds'->>1 then raise exception 'Two different canonical teams required'; end if;
 select jsonb_agg(coalesce((c.definition->'formatDecision'->'entryRosters')->ids.id,r.match_team) order by ids.n) into teams from jsonb_array_elements_text(p_fixture->'teamIds') with ordinality ids(id,n)
  join public.team_season_rosters r on r.team_id=ids.id::uuid and r.season_id=s.id;
 if jsonb_array_length(teams) is distinct from 2 or exists(select 1 from jsonb_array_elements(teams) t where jsonb_array_length(t->'players') is distinct from 35) then raise exception 'Two complete canonical season rosters required'; end if;
 input:=jsonb_build_object('id',p_fixture->>'id','seed',p_seed,'teams',teams,'provenance',jsonb_build_object('competitionId',c.id,'seasonKey',to_char(s.starts_on,'YYYY-MM'),'competitionCategory',c.competition_category,'classification','competitive','purpose','official','engineSourceSHA256',c.definition->>'engineSourceSHA256'));
 insert into public.competition_rosters(competition_id,team_id,season_roster_id)
  select c.id,r.team_id,r.id from public.team_season_rosters r where r.season_id=s.id and r.team_id in(select value::uuid from jsonb_array_elements_text(p_fixture->'teamIds')) on conflict do nothing;
 insert into public.competition_fixtures values((p_fixture->>'id')::uuid,c.id,(select coalesce(max(ordinal)+1,0) from public.competition_fixtures where competition_id=c.id),p_fixture->>'roundId',input);
 insert into private.official_fixture_metadata values((p_fixture->>'id')::uuid,c.id,stream,date_value,p_source,p_replaces,p_reason);
end $$;
create or replace function public.create_official_competition_v1(p_actor uuid,p_id uuid,p_season uuid,p_name text,p_fixtures jsonb,p_format jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.seasons; g private.official_release_gates; c public.competitions; definition jsonb; f jsonb; begin
 perform private.require_match_commissioner_v1(p_actor);
 select * into s from public.seasons where id=p_season for share;
 if not found or s.status='complete' then raise exception 'Available season required'; end if;
 -- Serialize only the initializer; the category journal serializes sporting writes.
 perform pg_advisory_xact_lock(hashtext('century-official-create'),hashtext(s.competition_category));
 perform private.require_official_draft_ready_v1(s.competition_category);
 select * into g from private.official_release_gates where category=s.competition_category;
 if coalesce(length(trim(p_name)),0) not between 1 and 160 or jsonb_typeof(p_fixtures) is distinct from 'array' or jsonb_array_length(p_fixtures) not between 1 and 500
  or jsonb_typeof(p_format) is distinct from 'object' or coalesce(length(trim(p_format->>'reference')),0)<10 then raise exception 'Name, explicit fixtures and recorded format decision required'; end if;
 if p_format ? 'id' and p_format->>'id'='inaugural-18-double-elimination-v1' then
  perform private.validate_inaugural_format_v1(p_season,p_format,p_fixtures,p_id);
 end if;
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
create or replace function private.guard_official_competition_v1() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.classification='competitive' then
  if new.status='draft' then perform private.require_official_draft_ready_v1(new.competition_category);
  else perform private.require_official_ready_v1(new.competition_category); end if;
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

create function private.inaugural_fixture_id_v1(p_competition uuid,p_code text) returns uuid
language sql immutable security invoker set search_path='' as $$ select md5(p_competition::text||':'||p_code)::uuid $$;
create function private.inaugural_initial_fixtures_v1(p_id uuid,p_format jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_agg(jsonb_build_object('id',private.inaugural_fixture_id_v1(p_id,s->>'code'),'roundId','Window 1','matchDate',s->>'matchDate',
  'teamIds',jsonb_build_array(p_format->'seedTeamIds'->>substring(s->'entrants'->>0 from 2),p_format->'seedTeamIds'->>substring(s->'entrants'->>1 from 2))) order by s->>'code')
 from jsonb_array_elements(p_format->'slots') s where (s->>'window')::integer=1;
$$;
create function private.validate_inaugural_format_v1(p_season uuid,p_format jsonb,p_fixtures jsonb,p_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare seed jsonb; tid uuid; roster jsonb; begin
 if p_format-'seedTeamIds'-'entryRosters' is distinct from private.inaugural_template_v1()
  or not exists(select 1 from public.seasons where id=p_season and competition_category='men' and starts_on='2026-11-01')
  or jsonb_typeof(p_format->'seedTeamIds') is distinct from 'object' or jsonb_typeof(p_format->'entryRosters') is distinct from 'object' then raise exception 'Exact approved inaugural format and November entry season required'; end if;
 if (select count(*) from jsonb_object_keys(p_format->'seedTeamIds'))<>18 or (select count(distinct value) from jsonb_each_text(p_format->'seedTeamIds'))<>18
  or (select count(*) from jsonb_object_keys(p_format->'entryRosters'))<>18 then raise exception 'Exactly eighteen distinct seeded entry rosters required'; end if;
 for seed in select value from jsonb_array_elements(p_format->'seeds') loop
  tid:=(p_format->'seedTeamIds'->>(seed->>'seed'))::uuid;
  select r.match_team into roster from public.team_season_rosters r join public.teams t on t.id=r.team_id
   where r.season_id=p_season and r.team_id=tid and t.name=seed->>'name';
  if roster is null or roster is distinct from p_format->'entryRosters'->tid::text or jsonb_array_length(roster->'players')<>35 then raise exception 'Seed or frozen roster differs from canonical November snapshot'; end if;
 end loop;
 if p_fixtures is distinct from private.inaugural_initial_fixtures_v1(p_id,p_format) then raise exception 'Exact opening eight inaugural fixtures required'; end if;
end $$;

-- Active leaf results only. A voided or superseded source never advances a club.
create function private.inaugural_result_team_v1(p_competition uuid,p_code text,p_loser boolean default false) returns text
language sql stable security invoker set search_path='' as $$
 with recursive leaves as (
  select private.inaugural_fixture_id_v1(p_competition,p_code) id
  union all select m.fixture_id from private.official_fixture_metadata m join leaves l on m.source_fixture_id=l.id
 ) select e.payload->'accepted'->'teamIds'->>((e.payload->'accepted'->>'winner')::integer # case when p_loser then 1 else 0 end)
 from leaves l join public.official_result_dispositions d on d.fixture_id=l.id and d.voided_by is null
 join private.competition_operation_events_candidate e on e.stream_id=d.stream_id and e.id=d.accepted_event_id
 where not exists(select 1 from private.official_fixture_metadata child where child.source_fixture_id=l.id);
$$;
create function private.inaugural_entrant_v1(p_competition uuid,p_route text) returns text
language plpgsql stable security invoker set search_path='' as $$
declare f jsonb; pool text[]; picked text; rank integer; begin
 select definition->'formatDecision' into f from public.competitions where id=p_competition;
 if p_route ~ '^S[0-9]+$' then return f->'seedTeamIds'->>substring(p_route from 2); end if;
 if p_route ~ '^[WL]:M[0-9]{2}$' then return private.inaugural_result_team_v1(p_competition,substring(p_route from 3),left(p_route,1)='L'); end if;
 if p_route ~ '^[AB]:[1-4]$' then
  pool:=case left(p_route,1) when 'A' then array['M13','M14','M19','M20'] else array['M21','M22','M23','M24'] end;
  if exists(select 1 from unnest(pool) code where private.inaugural_result_team_v1(p_competition,code,true) is null) then return null; end if;
  rank:=substring(p_route from 3)::integer;
  select team into picked from (
   select private.inaugural_result_team_v1(p_competition,code,true) team from unnest(pool) code
  ) q order by (select key::integer from jsonb_each_text(f->'seedTeamIds') where value=q.team) offset rank-1 limit 1;
  return picked;
 end if;
 raise exception 'Unknown inaugural entrant route';
end $$;
create function private.inaugural_slot_teams_v1(p_competition uuid,p_slot jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when p_slot ? 'pool' then jsonb_build_array(
  private.inaugural_entrant_v1(p_competition,(p_slot->>'pool')||':'||(p_slot->'ranks'->>0)),
  private.inaugural_entrant_v1(p_competition,(p_slot->>'pool')||':'||(p_slot->'ranks'->>1)))
 else jsonb_build_array(private.inaugural_entrant_v1(p_competition,p_slot->'entrants'->>0),private.inaugural_entrant_v1(p_competition,p_slot->'entrants'->>1)) end;
$$;
create function private.inaugural_reset_needed_v1(p_competition uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select case when private.inaugural_result_team_v1(p_competition,'M38') is null then null
 else private.inaugural_result_team_v1(p_competition,'M38')=private.inaugural_result_team_v1(p_competition,'M37') end;
$$;
create function public.register_inaugural_tournament_v1(p_actor uuid,p_id uuid,p_season uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare f jsonb:=private.inaugural_template_v1(); seed jsonb; ids jsonb:='{}'; rosters jsonb:='{}'; r public.team_season_rosters; receipt jsonb; begin
 perform private.require_match_commissioner_v1(p_actor);
 -- Canonical registration retry returns the existing identity without recapturing rosters.
 if exists(select 1 from public.competitions where id=p_id) then
  if not exists(select 1 from public.competitions where id=p_id and season_id=p_season and created_by=p_actor
   and (definition->'formatDecision')-'seedTeamIds'-'entryRosters'=f) then raise exception 'Conflicting inaugural registration'; end if;
  return jsonb_build_object('id',p_id,'added',false);
 end if;
 for seed in select value from jsonb_array_elements(f->'seeds') loop
  select snap.* into r from public.team_season_rosters snap join public.teams t on t.id=snap.team_id where snap.season_id=p_season and t.name=seed->>'name';
  if not found then raise exception 'Missing canonical seeded club'; end if;
  ids:=ids||jsonb_build_object(seed->>'seed',r.team_id); rosters:=rosters||jsonb_build_object(r.team_id,r.match_team);
 end loop;
 f:=f||jsonb_build_object('seedTeamIds',ids,'entryRosters',rosters);
 receipt:=public.create_official_competition_v1(p_actor,p_id,p_season,'Century League Inaugural Tournament 2026',private.inaugural_initial_fixtures_v1(p_id,f),f);
 insert into public.competition_rosters select p_id,team_id,id from public.team_season_rosters where season_id=p_season and team_id::text in(select value from jsonb_each_text(ids)) on conflict do nothing;
 return receipt;
end $$;

create function public.read_official_tournament_v1(p_actor uuid,p_competition uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare f jsonb; slots jsonb:='[]'; slot jsonb; teams jsonb; done boolean; skipped boolean; begin
 perform private.require_match_commissioner_v1(p_actor);
 select definition->'formatDecision' into f from public.competitions where id=p_competition;
 if f->>'id' is distinct from 'inaugural-18-double-elimination-v1' then return null; end if;
 for slot in select value from jsonb_array_elements(f->'slots') loop
  teams:=private.inaugural_slot_teams_v1(p_competition,slot);
  done:=private.inaugural_result_team_v1(p_competition,slot->>'code') is not null;
  skipped:=(slot->>'code'='M39' and private.inaugural_reset_needed_v1(p_competition)=false);
  slots:=slots||jsonb_build_array((slot-'entrants')||jsonb_build_object('fixtureId',private.inaugural_fixture_id_v1(p_competition,slot->>'code'),
   'routes',case when slot ? 'pool' then jsonb_build_array((slot->>'pool')||':'||(slot->'ranks'->>0),(slot->>'pool')||':'||(slot->'ranks'->>1)) else slot->'entrants' end,
   'teamIds',teams,'status',case when skipped then 'not-needed' when done then 'accepted' when teams->>0 is null or teams->>1 is null then 'awaiting-results'
    when exists(select 1 from public.competition_fixtures where id=private.inaugural_fixture_id_v1(p_competition,slot->>'code')) then 'scheduled' else 'ready-to-prepare' end));
 end loop;
 return jsonb_build_object('formatId',f->>'id','startsOn',f->>'startsOn','endsOn',f->>'endsOn','timeZone',f->>'timeZone','rosterPolicy',f->>'rosterPolicy','slots',slots,
  'seeds',(select jsonb_agg(s||jsonb_build_object('teamId',f->'seedTeamIds'->>(s->>'seed'))) from jsonb_array_elements(f->'seeds') s),
  'divisions',jsonb_build_object(
   'Championship',jsonb_build_array(private.inaugural_result_team_v1(p_competition,'M35'),private.inaugural_result_team_v1(p_competition,'M37')),
   'Division One',jsonb_build_array(private.inaugural_result_team_v1(p_competition,'M37',true),private.inaugural_result_team_v1(p_competition,'M36',true),private.inaugural_result_team_v1(p_competition,'M33',true),private.inaugural_result_team_v1(p_competition,'M34',true)),
   'Division Two',jsonb_build_array(private.inaugural_result_team_v1(p_competition,'M29',true),private.inaugural_result_team_v1(p_competition,'M30',true),private.inaugural_result_team_v1(p_competition,'M31'),private.inaugural_result_team_v1(p_competition,'M32')),
   'Division Three',jsonb_build_array(private.inaugural_result_team_v1(p_competition,'M31',true),private.inaugural_result_team_v1(p_competition,'M32',true),private.inaugural_result_team_v1(p_competition,'M25'),private.inaugural_result_team_v1(p_competition,'M26')),
   'Division Four',jsonb_build_array(private.inaugural_result_team_v1(p_competition,'M25',true),private.inaugural_result_team_v1(p_competition,'M26',true),private.inaugural_result_team_v1(p_competition,'M11',true),private.inaugural_result_team_v1(p_competition,'M12',true))),
  'complete',not exists(select 1 from jsonb_array_elements(slots) s where s->>'status' not in ('accepted','not-needed')),
  'champion',case when private.inaugural_reset_needed_v1(p_competition) then private.inaugural_result_team_v1(p_competition,'M39') else private.inaugural_result_team_v1(p_competition,'M38') end,
  'decemberDivisionalWindow',f->'decemberDivisionalWindow');
end $$;
create function public.advance_official_tournament_v1(p_actor uuid,p_competition uuid,p_expected_revision integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.competitions; stream uuid; slot jsonb; teams jsonb; added integer:=0; begin
 perform private.require_match_commissioner_v1(p_actor);
 select stream_id into stream from private.official_competition_bindings where competition_id=p_competition;
 perform 1 from private.competition_operation_streams_candidate where id=stream for update;
 if not exists(select 1 from private.competition_operation_streams_candidate where id=stream and revision=p_expected_revision) then raise exception 'Stale category journal revision' using errcode='40001'; end if;
 select * into c from public.competitions where id=p_competition for update;
 if c.definition->'formatDecision'->>'id' is distinct from 'inaugural-18-double-elimination-v1' or c.status='complete' then raise exception 'Open inaugural tournament required'; end if;
 for slot in select value from jsonb_array_elements(c.definition->'formatDecision'->'slots') loop
  if slot->>'code'='M39' and private.inaugural_reset_needed_v1(c.id) is distinct from true then continue; end if;
  if exists(select 1 from public.competition_fixtures where id=private.inaugural_fixture_id_v1(c.id,slot->>'code')) then continue; end if;
  teams:=private.inaugural_slot_teams_v1(c.id,slot);
  if teams->>0 is null or teams->>1 is null then continue; end if;
  perform private.insert_official_fixture_v1(c.id,jsonb_build_object('id',private.inaugural_fixture_id_v1(c.id,slot->>'code'),'roundId','Window '||(slot->>'window'),'matchDate',slot->>'matchDate','teamIds',teams),c.id::text||':'||private.inaugural_fixture_id_v1(c.id,slot->>'code')::text);
  added:=added+1;
 end loop;
 return jsonb_build_object('added',added,'tournament',public.read_official_tournament_v1(p_actor,c.id));
end $$;

-- Route and correction guards apply to direct backend RPCs as well as the UI.
create function private.assert_inaugural_fixture_v1(p_fixture uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare f public.competition_fixtures; c public.competitions; root uuid:=p_fixture; parent uuid; slot jsonb; teams jsonb; begin
 select * into f from public.competition_fixtures where id=p_fixture;
 select * into c from public.competitions where id=f.competition_id;
 if c.definition->'formatDecision'->>'id' is distinct from 'inaugural-18-double-elimination-v1' then return null; end if;
 loop
  select source_fixture_id into parent from private.official_fixture_metadata where fixture_id=root;
  exit when parent is null; root:=parent;
 end loop;
 select s into slot from jsonb_array_elements(c.definition->'formatDecision'->'slots') s where private.inaugural_fixture_id_v1(c.id,s->>'code')=root;
 teams:=private.inaugural_slot_teams_v1(c.id,slot);
 if slot is null or teams->>0 is null or teams->>1 is null
  or teams is distinct from jsonb_build_array(f.match_input->'teams'->0->>'id',f.match_input->'teams'->1->>'id')
  or (slot->>'code'='M39' and private.inaugural_reset_needed_v1(c.id) is distinct from true)
  or not exists(select 1 from private.official_fixture_metadata where fixture_id=p_fixture and match_date=(slot->>'matchDate')::date)
  or f.round_id is distinct from 'Window '||(slot->>'window') then raise exception 'Fixture differs from current approved bracket; commissioner correction required'; end if;
 return slot;
end $$;
create function private.guard_inaugural_metadata_v1() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 perform private.assert_inaugural_fixture_v1(new.fixture_id); return new;
end $$;
create trigger guard_inaugural_metadata after insert on private.official_fixture_metadata for each row execute function private.guard_inaugural_metadata_v1();
create function private.require_inaugural_due_v1(p_fixture uuid) returns void
language plpgsql stable security invoker set search_path='' as $$ declare slot jsonb; begin
 slot:=private.assert_inaugural_fixture_v1(p_fixture);
 if slot is not null and now()<(slot->>'startsAt')::timestamptz then raise exception 'Scheduled match time has not arrived'; end if;
end $$;
create function private.guard_inaugural_pin_v1() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 perform private.require_inaugural_due_v1(new.fixture_id); return new;
end $$;
create trigger guard_inaugural_pin before insert on private.official_fixture_inputs for each row execute function private.guard_inaugural_pin_v1();
create function public.check_official_tournament_fixture_v1(p_actor uuid,p_fixture uuid) returns void
language plpgsql security invoker set search_path='' as $$ begin
 perform private.require_match_commissioner_v1(p_actor); perform private.require_inaugural_due_v1(p_fixture);
end $$;
create function private.guard_inaugural_completion_v1() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.status='complete' and new.definition->'formatDecision'->>'id'='inaugural-18-double-elimination-v1'
  and not (public.read_official_tournament_v1(new.created_by,new.id)->>'complete')::boolean then raise exception 'Pending bracket slots prevent tournament closure'; end if;
 return new;
end $$;
create trigger guard_inaugural_completion before update of status on public.competitions for each row execute function private.guard_inaugural_completion_v1();

-- Format approval is explicit and men's-only. Activation remains disabled.
update private.official_release_gates set format_approved=true where category='men' and stream_id is null;
do $$ declare fn record; begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
  (n.nspname='private' and p.proname in ('require_official_draft_ready_v1','inaugural_template_v1','inaugural_fixture_id_v1','inaugural_initial_fixtures_v1','validate_inaugural_format_v1','inaugural_result_team_v1','inaugural_entrant_v1','inaugural_slot_teams_v1','inaugural_reset_needed_v1','assert_inaugural_fixture_v1','require_inaugural_due_v1','guard_inaugural_metadata_v1','guard_inaugural_pin_v1','guard_inaugural_completion_v1'))
  or (n.nspname='public' and p.proname in ('register_inaugural_tournament_v1','read_official_tournament_v1','advance_official_tournament_v1','check_official_tournament_fixture_v1')) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
  execute format('grant execute on function %s to service_role',fn.signature);
 end loop;
end $$;
-- Single approved inaugural event; retries use its retained competition ID.
create unique index inaugural_single_event_v1 on public.competitions((definition->'formatDecision'->>'id'))
 where definition->'formatDecision'->>'id'='inaugural-18-double-elimination-v1';
create function private.guard_inaugural_event_v1() returns trigger language plpgsql security invoker set search_path='' as $$
declare fixture uuid; begin
 if new.payload->'operation'->>'type'='accept' then
  fixture:=(new.payload->'accepted'->>'fixtureId')::uuid;
  if exists(select 1 from private.official_fixture_metadata where fixture_id=fixture) then perform private.require_inaugural_due_v1(fixture); end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_inaugural_event_v1() from public,anon,authenticated;
grant execute on function private.guard_inaugural_event_v1() to service_role;
create trigger guard_inaugural_event before insert on private.competition_operation_events_candidate for each row execute function private.guard_inaugural_event_v1();
