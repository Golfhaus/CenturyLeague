import type { ArchetypeName, AttributeKey, Role, TalentClass } from './types.js';

export const GENERATOR_MODEL_VERSION = '1.0.0';
export const DEVELOPMENT_MODEL_VERSION = '1.1.0';
export const SEASONS_PER_YEAR = 12;

export const ENTRY_AGE_DISTRIBUTION = [
  { value: 16, weight: 0.1 },
  { value: 17, weight: 0.4 },
  { value: 18, weight: 1.0 },
  { value: 19, weight: 2.0 },
  { value: 20, weight: 12.0 },
  { value: 21, weight: 19.0 },
  { value: 22, weight: 25.0 },
  { value: 23, weight: 22.0 },
  { value: 24, weight: 16.0 },
  { value: 25, weight: 2.0 },
  { value: 26, weight: 0.5 }
] as const;

export const TALENT_CLASSES: Record<TalentClass, { weight: number; mean: number; sd: number }> = {
  below_average: { weight: 22.0, mean: -0.75, sd: 0.30 },
  average: { weight: 56.0, mean: 0.00, sd: 0.35 },
  above_average: { weight: 17.0, mean: 0.80, sd: 0.30 },
  star: { weight: 4.5, mean: 2.00, sd: 0.30 },
  exceptional: { weight: 0.5, mean: 3.00, sd: 0.25 }
};

export const ARCHETYPE_FREQUENCY: Record<ArchetypeName, number> = {
  inside_ball_winner: 10,
  outside_runner: 9,
  explosive_runner: 8,
  power_carrier: 7,
  field_general: 8,
  precision_distributor: 7,
  long_kicker: 5,
  aerial_target: 6,
  pressure_forward: 7,
  finisher: 6,
  lockdown_defender: 8,
  intercept_defender: 7,
  aerial_defender: 6,
  high_motor_utility: 4,
  balanced_all_rounder: 2
};

const m = (values: Partial<Record<AttributeKey, number>>) => values;

export const ARCHETYPE_MODIFIERS: Record<ArchetypeName, Partial<Record<AttributeKey, number>>> = {
  balanced_all_rounder: m({ awareness: 1, decisionMaking: 1, stamina: 1, kickingAccuracy: 1, groundBallSkill: 1 }),
  inside_ball_winner: m({ contestedPossession: 3, groundBallSkill: 2, strength: 2, tackling: 2, handPassing: 1, awareness: 1, speed: -1, kickingOnRun: -1 }),
  outside_runner: m({ speed: 3, stamina: 2, ballCarrying: 2, kickingOnRun: 2, kickingAccuracy: 1, evasion: 1, strength: -1, contestedPossession: -1 }),
  explosive_runner: m({ acceleration: 3, agility: 3, evasion: 2, ballCarrying: 2, speed: 1, strength: -1, aerialMarking: -1 }),
  power_carrier: m({ strength: 3, ballCarrying: 2, tackling: 2, contestedPossession: 2, kickingPower: 1, agility: -1, kickingOnRun: -1 }),
  field_general: m({ awareness: 3, decisionMaking: 3, anticipation: 2, handPassing: 2, kickingAccuracy: 1, composure: 1 }),
  precision_distributor: m({ kickingAccuracy: 3, handPassing: 3, decisionMaking: 2, kickingOnRun: 1, awareness: 1, tackling: -1, contestedPossession: -1 }),
  long_kicker: m({ kickingPower: 3, kickingAccuracy: 2, composure: 1, aerialMarking: 1, handPassing: -1, agility: -1 }),
  aerial_target: m({ aerialMarking: 3, verticalLeap: 3, strength: 2, composure: 1, anticipation: 1, agility: -1, groundBallSkill: -1 }),
  pressure_forward: m({ acceleration: 2, tackling: 2, anticipation: 2, kickingOnRun: 2, evasion: 1, composure: 1, defensiveSpoiling: -1 }),
  finisher: m({ kickingAccuracy: 3, kickingOnRun: 2, composure: 2, anticipation: 2, aerialMarking: 1, tackling: -1, defensiveSpoiling: -1 }),
  lockdown_defender: m({ tackling: 3, defensiveSpoiling: 3, strength: 2, awareness: 2, discipline: 1, kickingOnRun: -1, evasion: -1 }),
  intercept_defender: m({ anticipation: 3, awareness: 3, aerialMarking: 2, kickingAccuracy: 2, defensiveSpoiling: 1, strength: -1 }),
  aerial_defender: m({ defensiveSpoiling: 3, verticalLeap: 3, aerialMarking: 2, strength: 2, anticipation: 1, groundBallSkill: -1, agility: -1 }),
  high_motor_utility: m({ stamina: 3, recovery: 2, awareness: 2, groundBallSkill: 1, tackling: 1, handPassing: 1 })
};

export const ROLE_WEIGHTS: Record<Role, Partial<Record<AttributeKey, number>>> = {
  defensive: {
    tackling: 0.16, defensiveSpoiling: 0.14, awareness: 0.12, anticipation: 0.12,
    aerialMarking: 0.10, strength: 0.08, groundBallSkill: 0.07, kickingAccuracy: 0.06,
    stamina: 0.06, discipline: 0.05, acceleration: 0.04
  },
  central: {
    contestedPossession: 0.12, groundBallSkill: 0.12, handPassing: 0.10, awareness: 0.10,
    decisionMaking: 0.10, stamina: 0.10, kickingAccuracy: 0.08, ballCarrying: 0.08,
    tackling: 0.07, acceleration: 0.05, anticipation: 0.04, evasion: 0.04
  },
  attacking: {
    kickingAccuracy: 0.15, kickingOnRun: 0.13, aerialMarking: 0.11, anticipation: 0.10,
    composure: 0.10, acceleration: 0.09, evasion: 0.08, ballCarrying: 0.07,
    kickingPower: 0.06, verticalLeap: 0.05, awareness: 0.04, groundBallSkill: 0.02
  }
};

export const SECONDARY_ARCHETYPE_CHANCE = 0.40;
export const SECONDARY_ARCHETYPE_STRENGTH = 0.35;
export const OFF_PROFILE_GIFT_CHANCE = 0.05;
export const EXTREME_OUTLIER_CHANCE = 0.0075;
