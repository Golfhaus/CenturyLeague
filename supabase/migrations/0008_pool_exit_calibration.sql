-- CenturyLeague unsigned-player lifecycle calibration metadata.

create index pool_exit_evaluations_entry_window_idx
  on private.player_pool_exit_evaluations(entry_window_id);

update public.generator_versions
set config = jsonb_set(
      config,
      '{population_management,pool_exit_model}',
      '{
        "version": "1.0.0",
        "logit_intercept": -3.80,
        "age_pressure": {
          "after_22_per_year": 0.16,
          "additional_after_28_per_year": 0.16,
          "additional_after_32_per_year": 0.15
        },
        "unsigned_time_pressure": {
          "after_6_months_per_month": 0.035,
          "additional_after_18_months_per_month": 0.025,
          "additional_after_36_months_per_month": 0.020
        },
        "market_percentile_coefficient": 2.40,
        "twelve_month_trend_coefficient": -0.35,
        "prior_roster_adjustment": -0.75,
        "release_grace": {
          "through_6_months": -1.20,
          "through_12_months": -0.50
        },
        "career_persistence_coefficient": 0.12,
        "pool_pressure_sensitivity": 0.50,
        "pool_pressure_min": 0.85,
        "pool_pressure_max": 1.20
      }'::jsonb,
      true
    ),
    notes = coalesce(notes, '') || ' Pool-exit model v1.0 coefficients recorded in generator configuration.'
where version_name = 'Century Player Generator v1.0';
