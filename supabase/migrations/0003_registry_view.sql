-- CenturyLeague Player Registry v0.1
-- Rounded read model for the normal application UI.

create or replace view public.player_registry
with (security_invoker = true)
as
select
  p.id,
  p.first_name,
  p.last_name,
  p.competition_category,
  p.date_of_birth,
  p.birthplace_city,
  p.birthplace_region_code,
  p.birthplace_region_name,
  p.birthplace_country_code,
  p.birthplace_country_name,
  p.nationality_code,
  p.nationality_name,
  p.preferred_side,
  p.height_cm,
  p.weight_kg,
  p.primary_archetype,
  p.secondary_archetype,
  p.status,
  p.current_team_id,
  t.name as current_team_name,
  round(r.speed)::int as speed,
  round(r.acceleration)::int as acceleration,
  round(r.agility)::int as agility,
  round(r.strength)::int as strength,
  round(r.vertical_leap)::int as vertical_leap,
  round(r.stamina)::int as stamina,
  round(r.durability)::int as durability,
  round(r.recovery)::int as recovery,
  round(r.kicking_power)::int as kicking_power,
  round(r.kicking_accuracy)::int as kicking_accuracy,
  round(r.kicking_on_run)::int as kicking_on_run,
  round(r.opposite_side_skill)::int as opposite_side_skill,
  round(r.hand_passing)::int as hand_passing,
  round(r.ball_carrying)::int as ball_carrying,
  round(r.evasion)::int as evasion,
  round(r.aerial_marking)::int as aerial_marking,
  round(r.contested_possession)::int as contested_possession,
  round(r.ground_ball_skill)::int as ground_ball_skill,
  round(r.tackling)::int as tackling,
  round(r.defensive_spoiling)::int as defensive_spoiling,
  round(r.awareness)::int as awareness,
  round(r.decision_making)::int as decision_making,
  round(r.anticipation)::int as anticipation,
  round(r.composure)::int as composure,
  round(r.discipline)::int as discipline,
  round(r.defensive_rating)::int as defensive_rating,
  round(r.central_rating)::int as central_rating,
  round(r.attacking_rating)::int as attacking_rating,
  round(r.overall_rating)::int as overall_rating,
  r.best_role,
  r.updated_at
from public.players p
join public.player_ratings_current r on r.player_id = p.id
left join public.teams t on t.id = p.current_team_id;

grant select on public.player_registry to authenticated;
