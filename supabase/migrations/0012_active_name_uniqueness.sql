-- Prevent duplicate full names among simultaneously active Century players.
-- Retired/exited players release the name for potential future reuse.

create unique index if not exists players_active_full_name_unique_idx
  on public.players (
    lower(btrim(first_name)),
    lower(btrim(last_name))
  )
  where status = 'active';

update public.generator_versions
set config = jsonb_set(
      config,
      '{identity_generation}',
      '{
        "active_full_name_uniqueness": "global",
        "name_collision_resolution": "deterministic_name_only_reroll",
        "active_name_snapshot_required_for_commit": true
      }'::jsonb,
      true
    ),
    notes = coalesce(notes, '') || ' Active full-name uniqueness enforced globally; expanded name pools and deterministic name-only collision rerolls added before inaugural generation.'
where version_name = 'Century Player Generator v1.0';
