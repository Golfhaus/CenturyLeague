-- Infrastructure only. No credential, clock job, release gate or simulation is
-- created/enabled here. The separate controlled launch binds the approved event.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- Requests temporarily contain the dedicated worker bearer, so only privileged
-- backend infrastructure may inspect the outbound queue.
revoke all on schema net from public,anon,authenticated;
revoke all on table net.http_request_queue from public,anon,authenticated,service_role;
