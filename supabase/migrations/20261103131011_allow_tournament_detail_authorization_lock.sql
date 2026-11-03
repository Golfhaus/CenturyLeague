-- Commissioner authorization uses SELECT FOR SHARE. PostgREST must invoke
-- this RPC in a read/write transaction even though it returns read-only data.
-- Keep security invoker and all existing backend-only grants unchanged.
alter function public.read_official_tournament_v1(uuid,uuid) volatile;
notify pgrst, 'reload schema';
