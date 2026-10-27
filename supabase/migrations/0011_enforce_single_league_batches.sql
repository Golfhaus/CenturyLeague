-- Enforce single-league generation batches and season/category alignment.

create or replace function public.commit_generated_players(
  p_generator_version_id uuid,
  p_season_id uuid,
  p_seed text,
  p_players jsonb,
  p_created_by uuid default null,
  p_summary jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_batch_id uuid;
  v_item jsonb;
  v_player_id uuid;
  v_eligibility jsonb;
  v_count integer := jsonb_array_length(p_players);
  v_category text;
  v_season_category text;
begin
  if v_count <= 0 then
    raise exception 'Generated player payload must contain at least one player.';
  end if;

  v_category := p_players->0->>'competitionCategory';

  if v_category not in ('men','women') then
    raise exception 'Invalid competition category.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_players) x
    where x->>'competitionCategory' is distinct from v_category
  ) then
    raise exception 'Generation batches must contain exactly one competition category.';
  end if;

  select competition_category
  into v_season_category
  from public.seasons
  where id = p_season_id;

  if v_season_category is null then
    raise exception 'Eligibility season does not exist.';
  end if;

  if v_season_category <> v_category then
    raise exception 'Player category does not match eligibility season.';
  end if;

  insert into public.generation_batches (
    generator_version_id,
    competition_category,
    mode,
    requested_count,
    generated_count,
    seed,
    committed,
    summary,
    created_by,
    completed_at
  )
  values (
    p_generator_version_id,
    v_category,
    'actual',
    v_count,
    v_count,
    p_seed,
    true,
    p_summary,
    p_created_by,
    now()
  )
  returning id into v_batch_id;

  for v_item in
    select value from jsonb_array_elements(p_players)
  loop
    insert into public.players (
      first_name,
      last_name,
      competition_category,
      date_of_birth,
      birthplace_city,
      birthplace_region_code,
      birthplace_region_name,
      birthplace_country_code,
      birthplace_country_name,
      nationality_code,
      nationality_name,
      preferred_side,
      height_cm,
      weight_kg,
      primary_archetype,
      secondary_archetype,
      status,
      current_team_id,
      generation_batch_id,
      generator_version_id,
      first_eligible_season_id,
      entry_type,
      entry_class_label
    )
    values (
      v_item->>'firstName',
      v_item->>'lastName',
      v_item->>'competitionCategory',
      (v_item->>'dateOfBirth')::date,
      nullif(v_item->>'birthplaceCity', ''),
      nullif(v_item->>'birthplaceRegionCode', ''),
      nullif(v_item->>'birthplaceRegionName', ''),
      v_item->>'birthplaceCountryCode',
      v_item->>'birthplaceCountryName',
      nullif(v_item->>'nationalityCode', ''),
      nullif(v_item->>'nationalityName', ''),
      v_item->>'preferredSide',
      (v_item->>'heightCm')::numeric,
      (v_item->>'weightKg')::numeric,
      v_item->>'primaryArchetype',
      nullif(v_item->>'secondaryArchetype', ''),
      'active',
      null,
      v_batch_id,
      p_generator_version_id,
      p_season_id,
      v_item->>'entryType',
      nullif(v_item->>'entryClassLabel', '')
    )
    returning id into v_player_id;

    insert into public.player_ratings_current (
      player_id,
      speed, acceleration, agility, strength, vertical_leap, stamina, durability, recovery,
      kicking_power, kicking_accuracy, kicking_on_run, opposite_side_skill, hand_passing,
      ball_carrying, evasion, aerial_marking, contested_possession, ground_ball_skill, tackling,
      defensive_spoiling, awareness, decision_making, anticipation, composure, discipline,
      defensive_rating, central_rating, attacking_rating, overall_rating, best_role
    )
    values (
      v_player_id,
      (v_item#>>'{ratings,speed}')::numeric,
      (v_item#>>'{ratings,acceleration}')::numeric,
      (v_item#>>'{ratings,agility}')::numeric,
      (v_item#>>'{ratings,strength}')::numeric,
      (v_item#>>'{ratings,verticalLeap}')::numeric,
      (v_item#>>'{ratings,stamina}')::numeric,
      (v_item#>>'{ratings,durability}')::numeric,
      (v_item#>>'{ratings,recovery}')::numeric,
      (v_item#>>'{ratings,kickingPower}')::numeric,
      (v_item#>>'{ratings,kickingAccuracy}')::numeric,
      (v_item#>>'{ratings,kickingOnRun}')::numeric,
      (v_item#>>'{ratings,oppositeSideSkill}')::numeric,
      (v_item#>>'{ratings,handPassing}')::numeric,
      (v_item#>>'{ratings,ballCarrying}')::numeric,
      (v_item#>>'{ratings,evasion}')::numeric,
      (v_item#>>'{ratings,aerialMarking}')::numeric,
      (v_item#>>'{ratings,contestedPossession}')::numeric,
      (v_item#>>'{ratings,groundBallSkill}')::numeric,
      (v_item#>>'{ratings,tackling}')::numeric,
      (v_item#>>'{ratings,defensiveSpoiling}')::numeric,
      (v_item#>>'{ratings,awareness}')::numeric,
      (v_item#>>'{ratings,decisionMaking}')::numeric,
      (v_item#>>'{ratings,anticipation}')::numeric,
      (v_item#>>'{ratings,composure}')::numeric,
      (v_item#>>'{ratings,discipline}')::numeric,
      (v_item#>>'{roleRatings,defensive}')::numeric,
      (v_item#>>'{roleRatings,central}')::numeric,
      (v_item#>>'{roleRatings,attacking}')::numeric,
      (v_item#>>'{roleRatings,overall}')::numeric,
      v_item#>>'{roleRatings,bestRole}'
    );

    insert into private.player_generation_metadata (
      player_id, entry_age, talent_class, talent_latent, athleticism, power, coordination,
      endurance, game_sense, specialization, development_potential, development_speed,
      physical_peak_offset, technical_peak_offset, mental_peak_offset, decline_rate, longevity,
      retirement_tendency, career_persistence, geo_distance, geo_generation_tier, off_profile_gift,
      extreme_outlier, generation_metadata
    )
    values (
      v_player_id,
      (v_item#>>'{metadata,entryAge}')::integer,
      v_item#>>'{metadata,talentClass}',
      (v_item#>>'{metadata,talentLatent}')::numeric,
      (v_item#>>'{metadata,athleticism}')::numeric,
      (v_item#>>'{metadata,power}')::numeric,
      (v_item#>>'{metadata,coordination}')::numeric,
      (v_item#>>'{metadata,endurance}')::numeric,
      (v_item#>>'{metadata,gameSense}')::numeric,
      (v_item#>>'{metadata,specialization}')::numeric,
      (v_item#>>'{metadata,developmentPotential}')::numeric,
      (v_item#>>'{metadata,developmentSpeed}')::numeric,
      (v_item#>>'{metadata,physicalPeakOffset}')::numeric,
      (v_item#>>'{metadata,technicalPeakOffset}')::numeric,
      (v_item#>>'{metadata,mentalPeakOffset}')::numeric,
      (v_item#>>'{metadata,declineRate}')::numeric,
      (v_item#>>'{metadata,longevity}')::numeric,
      (v_item#>>'{metadata,retirementTendency}')::numeric,
      (v_item#>>'{metadata,careerPersistence}')::numeric,
      nullif(v_item#>>'{metadata,geoDistance}', '')::integer,
      nullif(v_item#>>'{metadata,geoGenerationTier}', ''),
      coalesce((v_item#>>'{metadata,offProfileGift}')::boolean, false),
      coalesce((v_item#>>'{metadata,extremeOutlier}')::boolean, false),
      coalesce(v_item#>'{metadata,extra}', '{}'::jsonb)
    );

    insert into public.player_season_snapshots (
      player_id, season_id, age_years, team_id, status,
      speed, acceleration, agility, strength, vertical_leap, stamina, durability, recovery,
      kicking_power, kicking_accuracy, kicking_on_run, opposite_side_skill, hand_passing,
      ball_carrying, evasion, aerial_marking, contested_possession, ground_ball_skill, tackling,
      defensive_spoiling, awareness, decision_making, anticipation, composure, discipline,
      defensive_rating, central_rating, attacking_rating, overall_rating, best_role, model_version
    )
    values (
      v_player_id,
      p_season_id,
      (v_item->>'ageYears')::numeric,
      null,
      'active',
      (v_item#>>'{ratings,speed}')::numeric,
      (v_item#>>'{ratings,acceleration}')::numeric,
      (v_item#>>'{ratings,agility}')::numeric,
      (v_item#>>'{ratings,strength}')::numeric,
      (v_item#>>'{ratings,verticalLeap}')::numeric,
      (v_item#>>'{ratings,stamina}')::numeric,
      (v_item#>>'{ratings,durability}')::numeric,
      (v_item#>>'{ratings,recovery}')::numeric,
      (v_item#>>'{ratings,kickingPower}')::numeric,
      (v_item#>>'{ratings,kickingAccuracy}')::numeric,
      (v_item#>>'{ratings,kickingOnRun}')::numeric,
      (v_item#>>'{ratings,oppositeSideSkill}')::numeric,
      (v_item#>>'{ratings,handPassing}')::numeric,
      (v_item#>>'{ratings,ballCarrying}')::numeric,
      (v_item#>>'{ratings,evasion}')::numeric,
      (v_item#>>'{ratings,aerialMarking}')::numeric,
      (v_item#>>'{ratings,contestedPossession}')::numeric,
      (v_item#>>'{ratings,groundBallSkill}')::numeric,
      (v_item#>>'{ratings,tackling}')::numeric,
      (v_item#>>'{ratings,defensiveSpoiling}')::numeric,
      (v_item#>>'{ratings,awareness}')::numeric,
      (v_item#>>'{ratings,decisionMaking}')::numeric,
      (v_item#>>'{ratings,anticipation}')::numeric,
      (v_item#>>'{ratings,composure}')::numeric,
      (v_item#>>'{ratings,discipline}')::numeric,
      (v_item#>>'{roleRatings,defensive}')::numeric,
      (v_item#>>'{roleRatings,central}')::numeric,
      (v_item#>>'{roleRatings,attacking}')::numeric,
      (v_item#>>'{roleRatings,overall}')::numeric,
      v_item#>>'{roleRatings,bestRole}',
      v_item->>'generatorModelVersion'
    );

    for v_eligibility in
      select value from jsonb_array_elements(
        coalesce(v_item->'representativeEligibility', '[]'::jsonb)
      )
    loop
      insert into public.player_representative_eligibility (
        player_id, eligibility_type, eligibility_code, eligibility_name, source
      )
      values (
        v_player_id,
        v_eligibility->>'type',
        v_eligibility->>'code',
        v_eligibility->>'name',
        coalesce(v_eligibility->>'source', 'birthplace')
      )
      on conflict (player_id, eligibility_type, eligibility_code) do nothing;
    end loop;
  end loop;

  return jsonb_build_object(
    'batchId', v_batch_id,
    'generatedCount', v_count,
    'competitionCategory', v_category
  );
end;
$$;
