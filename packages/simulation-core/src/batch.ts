import { generatePermanentPlayer, type GeneratedPermanentPlayer, type PlayerEntryType } from './playerFactory.js';
import type { CompetitionCategory } from './types.js';

export interface PlayerBatchInput {
  seed: string;
  competitionCategory: CompetitionCategory;
  count: number;
  seasonStart: string;
  entryType: PlayerEntryType;
  entryClassLabel: string;
}

export interface PlayerBatchSummary {
  generatedCount: number;
  competitionCategory: CompetitionCategory;
  averageOverall: number;
  averageAgeYears: number;
  talentClasses: Record<string, number>;
  archetypes: Record<string, number>;
  entryAges: Record<string, number>;
  birthplaceTiers: Record<string, number>;
  internationalCount: number;
}

export interface GeneratedPlayerBatch {
  seed: string;
  competitionCategory: CompetitionCategory;
  players: GeneratedPermanentPlayer[];
  summary: PlayerBatchSummary;
}

function checkedCount(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('count must be a positive integer.');
  }
  return value;
}

function addCount(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

export function summarizePlayerBatch(
  players: readonly GeneratedPermanentPlayer[],
  competitionCategory: CompetitionCategory
): PlayerBatchSummary {
  const talentClasses: Record<string, number> = {};
  const archetypes: Record<string, number> = {};
  const entryAges: Record<string, number> = {};
  const birthplaceTiers: Record<string, number> = {};
  let totalOverall = 0;
  let totalAge = 0;
  let internationalCount = 0;

  for (const player of players) {
    if (player.competitionCategory !== competitionCategory) {
      throw new Error('Mixed competition categories are not allowed in one generation batch.');
    }
    totalOverall += player.roleRatings.overall;
    totalAge += player.ageYears;
    addCount(talentClasses, player.metadata.talentClass);
    addCount(archetypes, player.primaryArchetype);
    addCount(entryAges, String(player.metadata.entryAge));
    addCount(birthplaceTiers, player.metadata.geoGenerationTier);
    if (player.birthplaceCountryCode !== 'US') internationalCount += 1;
  }

  return {
    generatedCount:players.length,
    competitionCategory,
    averageOverall:players.length ? totalOverall / players.length : 0,
    averageAgeYears:players.length ? totalAge / players.length : 0,
    talentClasses,
    archetypes,
    entryAges,
    birthplaceTiers,
    internationalCount
  };
}

export function generatePlayerBatch(input: PlayerBatchInput): GeneratedPlayerBatch {
  const count = checkedCount(input.count);
  if (count > 2000) throw new Error('A single batch may not exceed 2,000 players.');

  const players: GeneratedPermanentPlayer[] = [];

  for (let i = 0; i < count; i += 1) {
    players.push(generatePermanentPlayer({
      seed:`${input.seed}:${input.competitionCategory}:${i}`,
      competitionCategory:input.competitionCategory,
      seasonStart:input.seasonStart,
      entryType:input.entryType,
      entryClassLabel:input.entryClassLabel
    }));
  }

  return {
    seed:input.seed,
    competitionCategory:input.competitionCategory,
    players,
    summary:summarizePlayerBatch(players, input.competitionCategory)
  };
}
