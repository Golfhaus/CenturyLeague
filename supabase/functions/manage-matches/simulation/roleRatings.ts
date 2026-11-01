import { ROLE_WEIGHTS } from './config.ts';
import type { Ratings, Role } from './types.ts';

export function calculateRoleRating(ratings: Ratings, role: Role): number {
  const weights = ROLE_WEIGHTS[role];
  return Object.entries(weights).reduce((sum, [attribute, weight]) => {
    return sum + ratings[attribute as keyof Ratings] * (weight ?? 0);
  }, 0);
}

export function calculateRoleRatings(ratings: Ratings) {
  const defensiveRating = calculateRoleRating(ratings, 'defensive');
  const centralRating = calculateRoleRating(ratings, 'central');
  const attackingRating = calculateRoleRating(ratings, 'attacking');
  const ranked = [
    ['defensive', defensiveRating],
    ['central', centralRating],
    ['attacking', attackingRating]
  ] as const;
  const sorted = [...ranked].sort((a, b) => b[1] - a[1]);
  const overallRating = sorted[0][1] * 0.86 + sorted[1][1] * 0.10 + sorted[2][1] * 0.04;

  return {
    defensiveRating,
    centralRating,
    attackingRating,
    overallRating,
    bestRole: sorted[0][0]
  };
}
