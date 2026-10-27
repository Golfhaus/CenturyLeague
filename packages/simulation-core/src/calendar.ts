import { createRandom } from './random.js';

const DAY_MS = 86_400_000;

export const INAUGURAL_SEASON_NUMBER = 1;
export const INAUGURAL_SEASON_START = '2026-11-01';
export const INAUGURAL_SEASON_END = '2026-11-30';
export const INAUGURAL_EVENT_NAME = 'Inaugural Tournament';

function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcYears(date: Date, years: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCFullYear(copy.getUTCFullYear() + years);
  return copy;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function ageYearsOnDate(dateOfBirth: string, referenceDate: string): number {
  const birth = parseDateOnly(dateOfBirth);
  const reference = parseDateOnly(referenceDate);
  return (reference.getTime() - birth.getTime()) / (365.2425 * DAY_MS);
}

export function generateBirthDateForEntryAge(
  entryAge: number,
  referenceDate: string,
  seed: string
): string {
  const reference = parseDateOnly(referenceDate);
  const earliest = addDays(addUtcYears(reference, -(entryAge + 1)), 1);
  const latest = addUtcYears(reference, -entryAge);
  const daySpan = Math.floor((latest.getTime() - earliest.getTime()) / DAY_MS);
  const rng = createRandom(seed);
  const offset = Math.floor(rng.next() * (daySpan + 1));
  return formatDateOnly(addDays(earliest, offset));
}

export interface SeasonCalendarEntry {
  seasonNumber: number;
  seasonYear: number;
  seasonMonth: number;
  startsOn: string;
  endsOn: string;
  label: string;
  eventName: string | null;
}

export function seasonCalendarEntry(seasonNumber: number): SeasonCalendarEntry {
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) {
    throw new Error('seasonNumber must be a positive integer.');
  }

  const inauguralMonthIndex = 2026 * 12 + 10;
  const monthIndex = inauguralMonthIndex + seasonNumber - 1;
  const seasonYear = Math.floor(monthIndex / 12);
  const monthZeroBased = monthIndex % 12;
  const seasonMonth = monthZeroBased + 1;
  const start = new Date(Date.UTC(seasonYear, monthZeroBased, 1));
  const end = new Date(Date.UTC(seasonYear, monthZeroBased + 1, 0));
  const monthName = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC'
  }).format(start);

  return {
    seasonNumber,
    seasonYear,
    seasonMonth,
    startsOn: formatDateOnly(start),
    endsOn: formatDateOnly(end),
    label: `Season ${seasonNumber} — ${monthName} ${seasonYear}`,
    eventName: seasonNumber === INAUGURAL_SEASON_NUMBER ? INAUGURAL_EVENT_NAME : null
  };
}
