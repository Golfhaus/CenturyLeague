import type { RecoveryPolicy } from './availability.ts';

/** Adopted November 2, 2026. Old journals retain their original pinned policy. */
export const APPROVED_RECOVERY_POLICY: RecoveryPolicy = {
  id: 'recovery-calendar-v1',
  bands: [{ weight: 80, minimumDays: 1, maximumDays: 4 },
    { weight: 18, minimumDays: 5, maximumDays: 10 }, { weight: 2, minimumDays: 11, maximumDays: 28 }]
};
