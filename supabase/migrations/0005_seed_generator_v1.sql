-- CenturyLeague Player Registry v0.1
-- Seed the active universe-level generator defaults.

with inserted as (
  insert into public.generator_versions (
    version_name,
    model_version,
    config,
    notes
  )
  values (
    'Century Player Generator v1.0',
    '1.0.0',
    $json$
    {
      "entry_age_distribution": {
        "16": 0.001,
        "17": 0.004,
        "18": 0.010,
        "19": 0.020,
        "20": 0.120,
        "21": 0.190,
        "22": 0.250,
        "23": 0.220,
        "24": 0.160,
        "25": 0.020,
        "26": 0.005
      },
      "talent_distribution": {
        "below_average": 0.220,
        "average": 0.560,
        "above_average": 0.170,
        "star": 0.045,
        "exceptional": 0.005
      },
      "archetype_frequency": {
        "inside_ball_winner": 0.10,
        "outside_runner": 0.09,
        "explosive_runner": 0.08,
        "power_carrier": 0.07,
        "field_general": 0.08,
        "precision_distributor": 0.07,
        "long_kicker": 0.05,
        "aerial_target": 0.06,
        "pressure_forward": 0.07,
        "finisher": 0.06,
        "lockdown_defender": 0.08,
        "intercept_defender": 0.07,
        "aerial_defender": 0.06,
        "high_motor_utility": 0.04,
        "balanced_all_rounder": 0.02
      },
      "secondary_archetype_chance": 0.40,
      "secondary_archetype_strength": 0.35,
      "off_profile_gift_chance": 0.05,
      "extreme_outlier_chance": 0.0075,
      "geography": {
        "international_probability": 0.01,
        "domestic_regional_model_share": 0.95,
        "domestic_national_model_share": 0.05,
        "population_exponent": 0.70,
        "border_distance_decay": 0.40,
        "core_regions": ["VA", "MD", "DE", "PA", "DC", "NC"]
      },
      "rating_scale": {
        "minimum": 1,
        "maximum": 20,
        "stored_continuously": true
      },
      "development_model_version": "1.0.0"
    }
    $json$::jsonb,
    'Initial calibrated Century player-generation defaults.'
  )
  returning id
)
update public.league_state
set active_generator_version_id = (select id from inserted),
    active_development_model_version = '1.0.0',
    updated_at = now()
where id = 1;
