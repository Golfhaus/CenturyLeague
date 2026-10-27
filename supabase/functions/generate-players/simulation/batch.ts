import { normalizeFullName } from './identity.ts';
import { generatePermanentPlayer, type GeneratedPermanentPlayer, type PlayerEntryType } from './playerFactory.ts';
import type { CompetitionCategory } from './types.ts';

export interface PlayerBatchInput {
  seed: string;
  competitionCategory: CompetitionCategory;
  count: number;
  seasonStart: string;
  entryType: PlayerEntryType;
  entryClassLabel: string;
  reservedFullNames?: readonly string[];
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
  preferredSides: Record<string, number>;
  internationalCount: number;
  uniqueFirstNames: number;
  uniqueLastNames: number;
  nameCollisionRerolls: number;
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
  competitionCategory: CompetitionCategory,
  nameCollisionRerolls = 0
): PlayerBatchSummary {
  const talentClasses: Record<string, number> = {};
  const archetypes: Record<string, number> = {};
  const entryAges: Record<string, number> = {};
  const birthplaceTiers: Record<string, number> = {};
  const preferredSides: Record<string, number> = {};
  const firstNames = new Set<string>();
  const lastNames = new Set<string>();
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
    addCount(preferredSides, player.preferredSide);
    firstNames.add(player.firstName.toLocaleLowerCase('en-US'));
    lastNames.add(player.lastName.toLocaleLowerCase('en-US'));
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
    preferredSides,
    internationalCount,
    uniqueFirstNames:firstNames.size,
    uniqueLastNames:lastNames.size,
    nameCollisionRerolls
  };
}

export function generatePlayerBatch(input: PlayerBatchInput): GeneratedPlayerBatch {
  const count = checkedCount(input.count);
  if (count > 2000) throw new Error('A single batch may not exceed 2,000 players.');

  const players: GeneratedPermanentPlayer[] = [];
  const reservedNames = new Set(input.reservedFullNames ?? []);
  let nameCollisionRerolls = 0;

  for (let i = 0; i < count; i += 1) {
    const playerSeed = `${input.seed}:${input.competitionCategory}:${i}`;
    let accepted: GeneratedPermanentPlayer | null = null;

    for (let nameAttempt = 0; nameAttempt < 1000; nameAttempt += 1) {
      const candidate = generatePermanentPlayer({
        seed:playerSeed,
        competitionCategory:input.competitionCategory,
        seasonStart:input.seasonStart,
        entryType:input.entryType,
        entryClassLabel:input.entryClassLabel,
        nameAttempt
      });
      const nameKey = normalizeFullName(candidate.firstName, candidate.lastName);
      if (!reservedNames.has(nameKey)) {
        reservedNames.add(nameKey);
        accepted = candidate;
        break;
      }
      nameCollisionRerolls += 1;
    }

    if (!accepted) {
      throw new Error('Unable to generate a unique active player name after 1,000 attempts.');
    }
    players.push(accepted);
  }

  return {
    seed:input.seed,
    competitionCategory:input.competitionCategory,
    players,
    summary:summarizePlayerBatch(players, input.competitionCategory, nameCollisionRerolls)
  };
}
