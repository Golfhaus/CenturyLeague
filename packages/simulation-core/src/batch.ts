import { generatePermanentPlayer, type GeneratedPermanentPlayer, type PlayerEntryType } from './playerFactory.js';
import type { CompetitionCategory } from './types.js';

export interface PlayerBatchInput {
  seed: string;
  menCount: number;
  womenCount: number;
  seasonStart: string;
  entryType: PlayerEntryType;
  entryClassLabel: string;
}

export interface PlayerBatchSummary {
  generatedCount: number;
  menCount: number;
  womenCount: number;
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
  players: GeneratedPermanentPlayer[];
  summary: PlayerBatchSummary;
}

function checkedCount(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative integer.`);
  }
  return value;
}

function addCount(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

export function summarizePlayerBatch(
  players: readonly GeneratedPermanentPlayer[]
): PlayerBatchSummary {
  const talentClasses: Record<string, number> = {};
  const archetypes: Record<string, number> = {};
  const entryAges: Record<string, number> = {};
  const birthplaceTiers: Record<string, number> = {};
  let menCount = 0;
  let womenCount = 0;
  let totalOverall = 0;
  let totalAge = 0;
  let internationalCount = 0;

  for (const player of players) {
    if (player.competitionCategory === 'men') menCount += 1;
    else womenCount += 1;
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
    menCount,
    womenCount,
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
  const menCount = checkedCount(input.menCount, 'menCount');
  const womenCount = checkedCount(input.womenCount, 'womenCount');
  const total = menCount + womenCount;

  if (total < 1) throw new Error('At least one player must be requested.');
  if (total > 2000) throw new Error('A single batch may not exceed 2,000 players.');

  const players: GeneratedPermanentPlayer[] = [];

  function generateCategory(category: CompetitionCategory, count: number): void {
    for (let i = 0; i < count; i += 1) {
      players.push(generatePermanentPlayer({
        seed:`${input.seed}:${category}:${i}`,
        competitionCategory:category,
        seasonStart:input.seasonStart,
        entryType:input.entryType,
        entryClassLabel:input.entryClassLabel
      }));
    }
  }

  generateCategory('men', menCount);
  generateCategory('women', womenCount);

  return {
    seed:input.seed,
    players,
    summary:summarizePlayerBatch(players)
  };
}
