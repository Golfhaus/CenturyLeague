export const ATTRIBUTE_KEYS = [
  'speed', 'acceleration', 'agility', 'strength', 'verticalLeap', 'stamina',
  'durability', 'recovery', 'kickingPower', 'kickingAccuracy', 'kickingOnRun',
  'oppositeSideSkill', 'handPassing', 'ballCarrying', 'evasion', 'aerialMarking',
  'contestedPossession', 'groundBallSkill', 'tackling', 'defensiveSpoiling',
  'awareness', 'decisionMaking', 'anticipation', 'composure', 'discipline'
] as const;

export type AttributeKey = typeof ATTRIBUTE_KEYS[number];
export type Ratings = Record<AttributeKey, number>;
export type CompetitionCategory = 'men' | 'women';
export type Role = 'defensive' | 'central' | 'attacking';
export type TalentClass = 'below_average' | 'average' | 'above_average' | 'star' | 'exceptional';

export type ArchetypeName =
  | 'balanced_all_rounder'
  | 'inside_ball_winner'
  | 'outside_runner'
  | 'explosive_runner'
  | 'power_carrier'
  | 'field_general'
  | 'precision_distributor'
  | 'long_kicker'
  | 'aerial_target'
  | 'pressure_forward'
  | 'finisher'
  | 'lockdown_defender'
  | 'intercept_defender'
  | 'aerial_defender'
  | 'high_motor_utility';

export interface Foundations {
  athleticism: number;
  power: number;
  coordination: number;
  endurance: number;
  gameSense: number;
}

export interface GenerationInput {
  seed: string;
  competitionCategory: CompetitionCategory;
  entryAge: number;
  heightZ?: number;
  weightForHeightZ?: number;
}

export interface GeneratedRatingsProfile {
  ratings: Ratings;
  displayedRatings: Record<AttributeKey, number>;
  defensiveRating: number;
  centralRating: number;
  attackingRating: number;
  overallRating: number;
  bestRole: Role;
  talentClass: TalentClass;
  talentLatent: number;
  foundations: Foundations;
  specialization: number;
  primaryArchetype: ArchetypeName;
  secondaryArchetype: ArchetypeName | null;
  offProfileGift: boolean;
  extremeOutlier: boolean;
}
