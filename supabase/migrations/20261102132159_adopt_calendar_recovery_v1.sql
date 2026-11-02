-- Commissioner adoption, November 2, 2026. Existing validation journals keep
-- their immutable policies. No official stream/fixture is initialized here.
do $$
declare adopted jsonb:='{"id":"recovery-calendar-v1","bands":[{"weight":80,"minimumDays":1,"maximumDays":4},{"weight":18,"minimumDays":5,"maximumDays":10},{"weight":2,"minimumDays":11,"maximumDays":28}]}'::jsonb;
begin
 if (select count(*) from private.official_release_gates)<>2 or
    exists(select 1 from private.official_release_gates where stream_id is not null or activation_enabled or format_approved) or
    exists(select 1 from private.competition_operation_streams_candidate where purpose='official') then
  raise exception 'Recovery adoption requires uninitialized, inactive official categories';
 end if;
 update private.official_release_gates set policy=adopted,policy_approved=true;
end $$;
