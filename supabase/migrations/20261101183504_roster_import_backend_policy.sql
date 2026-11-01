-- Explicit backend-only policy; browser roles have no private-schema table privileges.
create policy roster_import_payloads_backend_only
on private.roster_import_payloads for all to service_role
using (true) with check (true);
