import {
  DEVELOPMENT_MODEL_VERSION,
  ENTRY_AGE_DISTRIBUTION,
  GENERATOR_MODEL_VERSION
} from './config.js';
import { ageYearsOnDate, generateBirthDateForEntryAge } from './calendar.js';
import { generateBody } from './body.js';
import { generateBirthplace } from './geography.js';
import { generatePlayerName, generatePreferredSide } from './identity.js';
import { generateRatingsProfile } from './generator.js';
import { generateDevelopmentProfile } from './poolLifecycle.js';
import { createRandom, weightedChoice } from './random.js';
import type { CompetitionCategory, Ratings } from './types.js';

export type PlayerEntryType = 'founding_pool' | 'entry_window';

export interface PermanentPlayerGenerationInput {
  seed: string;
  competitionCategory: CompetitionCategory;
  seasonStart: string;
  entryType: PlayerEntryType;
  entryClassLabel: string;
  entryAge?: number;
  nameAttempt?: number;
}

export interface GeneratedPermanentPlayer {
  firstName: string;
  lastName: string;
  competitionCategory: CompetitionCategory;
  dateOfBirth: string;
  ageYears: number;
  birthplaceCity: string;
  birthplaceRegionCode: string | null;
  birthplaceRegionName: string | null;
  birthplaceCountryCode: string;
  birthplaceCountryName: string;
  nationalityCode: string;
  nationalityName: string;
  preferredSide: 'left' | 'right' | 'both';
  heightCm: number;
  weightKg: number;
  primaryArchetype: string;
  secondaryArchetype: string;
  entryType: PlayerEntryType;
  entryClassLabel: string;
  ratings: Ratings;
  roleRatings: {
    defensive: number;
    central: number;
    attacking: number;
    overall: number;
    bestRole: 'defensive' | 'central' | 'attacking';
  };
  metadata: {
    entryAge: number;
    talentClass: string;
    talentLatent: number;
    athleticism: number;
    power: number;
    coordination: number;
    endurance: number;
    gameSense: number;
    specialization: number;
    developmentPotential: number;
    developmentSpeed: number;
    physicalPeakOffset: number;
    technicalPeakOffset: number;
    mentalPeakOffset: number;
    declineRate: number;
    longevity: number;
    retirementTendency: number;
    careerPersistence: number;
    geoDistance: number | null;
    geoGenerationTier: string;
    offProfileGift: boolean;
    extremeOutlier: boolean;
    extra: Record<string, unknown>;
  };
  representativeEligibility: Array<{
    type: string;
    code: string;
    name: string;
    source: 'birthplace';
  }>;
  generatorModelVersion: string;
}

function deriveSeed(seed: string, namespace: string): string {
  return `${seed}:${namespace}`;
}

export function generatePermanentPlayer(
  input: PermanentPlayerGenerationInput
): GeneratedPermanentPlayer {
  const ageRng = createRandom(deriveSeed(input.seed, 'entry-age'));
  const entryAge = input.entryAge ?? weightedChoice(
    ageRng,
    ENTRY_AGE_DISTRIBUTION.map((item) => ({
      value:item.value,
      weight:item.weight
    }))
  );

  const nameAttempt = input.nameAttempt ?? 0;
  const nameSeed = nameAttempt === 0
    ? deriveSeed(input.seed, 'name')
    : deriveSeed(input.seed, `name:${nameAttempt}`);
  const name = generatePlayerName(
    input.competitionCategory,
    nameSeed
  );
  const body = generateBody(
    input.competitionCategory,
    deriveSeed(input.seed, 'body')
  );
  const birthplace = generateBirthplace(
    deriveSeed(input.seed, 'birthplace')
  );
  const dateOfBirth = generateBirthDateForEntryAge(
    entryAge,
    input.seasonStart,
    deriveSeed(input.seed, 'birth-date')
  );
  const ratingsProfile = generateRatingsProfile({
    seed: deriveSeed(input.seed, 'ratings'),
    competitionCategory: input.competitionCategory,
    entryAge,
    heightZ: body.heightZ,
    weightForHeightZ: body.weightForHeightZ
  });
  const development = generateDevelopmentProfile(
    deriveSeed(input.seed, 'development')
  );

  return {
    firstName:name.firstName,
    lastName:name.lastName,
    competitionCategory:input.competitionCategory,
    dateOfBirth,
    ageYears:ageYearsOnDate(dateOfBirth, input.seasonStart),
    birthplaceCity:birthplace.city,
    birthplaceRegionCode:birthplace.regionCode,
    birthplaceRegionName:birthplace.regionName,
    birthplaceCountryCode:birthplace.countryCode,
    birthplaceCountryName:birthplace.countryName,
    nationalityCode:birthplace.nationalityCode,
    nationalityName:birthplace.nationalityName,
    preferredSide:generatePreferredSide(deriveSeed(input.seed, 'preferred-side')),
    heightCm:body.heightCm,
    weightKg:body.weightKg,
    primaryArchetype:ratingsProfile.primaryArchetype,
    secondaryArchetype:ratingsProfile.secondaryArchetype ?? '',
    entryType:input.entryType,
    entryClassLabel:input.entryClassLabel,
    ratings:ratingsProfile.ratings,
    roleRatings:{
      defensive:ratingsProfile.defensiveRating,
      central:ratingsProfile.centralRating,
      attacking:ratingsProfile.attackingRating,
      overall:ratingsProfile.overallRating,
      bestRole:ratingsProfile.bestRole
    },
    metadata:{
      entryAge,
      talentClass:ratingsProfile.talentClass,
      talentLatent:ratingsProfile.talentLatent,
      athleticism:ratingsProfile.foundations.athleticism,
      power:ratingsProfile.foundations.power,
      coordination:ratingsProfile.foundations.coordination,
      endurance:ratingsProfile.foundations.endurance,
      gameSense:ratingsProfile.foundations.gameSense,
      specialization:ratingsProfile.specialization,
      developmentPotential:development.developmentPotential,
      developmentSpeed:development.developmentSpeed,
      physicalPeakOffset:development.physicalPeakOffset,
      technicalPeakOffset:development.technicalPeakOffset,
      mentalPeakOffset:development.mentalPeakOffset,
      declineRate:development.declineRate,
      longevity:development.longevity,
      retirementTendency:development.retirementTendency,
      careerPersistence:development.careerPersistence,
      geoDistance:birthplace.geoDistance,
      geoGenerationTier:birthplace.geoGenerationTier,
      offProfileGift:ratingsProfile.offProfileGift,
      extremeOutlier:ratingsProfile.extremeOutlier,
      extra:{
        developmentModelVersion:DEVELOPMENT_MODEL_VERSION
      }
    },
    representativeEligibility:birthplace.representativeEligibility,
    generatorModelVersion:GENERATOR_MODEL_VERSION
  };
}
