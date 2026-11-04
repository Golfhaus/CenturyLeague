-- API sessions load safeupdate; singleton tables still require an explicit filter.
-- Preserve function owners, ACLs, security modes, leases and match semantics.
do $repair$
declare signature text; definition text; statement text; repaired integer:=0;
begin
 foreach signature in array array[
  'public.claim_scheduled_official_v1(text)',
  'public.finish_scheduled_official_v1(text,uuid,uuid,text,text)',
  'public.control_scheduled_official_v1(uuid,boolean,text)',
  'private.dispatch_scheduled_official_v1()'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  for statement in select m[1] from regexp_matches(definition,'(update private\.scheduled_official_control set [^;]+);','gi') m loop
   if statement ~* '\mwhere\M' then raise exception 'Unexpected pre-filtered control update in %',signature; end if;
   definition:=replace(definition,statement||';',statement||' where singleton = true;');
   repaired:=repaired+1;
  end loop;
  execute definition;
 end loop;
 if repaired<>6 then raise exception 'Expected six control updates, found %',repaired; end if;
end $repair$;
