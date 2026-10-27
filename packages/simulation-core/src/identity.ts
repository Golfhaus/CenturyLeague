import { createRandom, weightedChoice } from './random.js';
import { MEN_FIRST_NAMES, SURNAMES, WOMEN_FIRST_NAMES } from './nameData.js';
import type { CompetitionCategory } from './types.js';

export function normalizeFullName(firstName: string, lastName: string): string {
  return `${firstName.trim().toLocaleLowerCase('en-US')}\u0000${lastName.trim().toLocaleLowerCase('en-US')}`;
}

export function generatePlayerName(
  category: CompetitionCategory,
  seed: string
): { firstName: string; lastName: string } {
  const rng = createRandom(seed);
  const firstPool = category === 'men' ? MEN_FIRST_NAMES : WOMEN_FIRST_NAMES;
  return {
    firstName: firstPool[Math.floor(rng.next() * firstPool.length)],
    lastName: SURNAMES[Math.floor(rng.next() * SURNAMES.length)]
  };
}

export function generatePreferredSide(seed: string): 'left' | 'right' | 'both' {
  const rng = createRandom(seed);
  return weightedChoice(rng, [
    { value:'right' as const, weight:78 },
    { value:'left' as const, weight:18 },
    { value:'both' as const, weight:4 }
  ]);
}
