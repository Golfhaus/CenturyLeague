import { createRandom } from './random.ts';

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

export function integerAgeOnDate(dateOfBirth: string, referenceDate: string): number {
  const birth = parseDateOnly(dateOfBirth);
  const reference = parseDateOnly(referenceDate);
  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    reference.getUTCMonth() < birth.getUTCMonth()
    || (
      reference.getUTCMonth() === birth.getUTCMonth()
      && reference.getUTCDate() < birth.getUTCDate()
    );
  if (beforeBirthday) age -= 1;
  return age;
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


export const ENTRY_WINDOW_TRIGGER_MONTHS = [3, 6, 9, 12] as const;

export function isEntryWindowTriggerMonth(month: number): boolean {
  return ENTRY_WINDOW_TRIGGER_MONTHS.includes(month as 3 | 6 | 9 | 12);
}

export function entryWindowName(triggerYear: number, triggerMonth: number): string {
  const names: Record<number, string> = {
    3: 'Spring',
    6: 'Summer',
    9: 'Fall',
    12: 'Winter'
  };
  const name = names[triggerMonth];
  if (!name) throw new Error('Entry windows occur only after March, June, September, and December seasons.');
  return `${name} ${triggerYear}`;
}

export function entryClassLabelForTriggerSeason(
  triggerYear: number,
  triggerMonth: number
): string {
  if (!isEntryWindowTriggerMonth(triggerMonth)) {
    throw new Error('Entry class requested for a non-entry-window month.');
  }

  const nextMonthIndex = triggerYear * 12 + (triggerMonth - 1) + 1;
  const availableYear = Math.floor(nextMonthIndex / 12);
  const availableMonth = (nextMonthIndex % 12) + 1;
  const date = new Date(Date.UTC(availableYear, availableMonth - 1, 1));
  const monthName = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC'
  }).format(date);
  return `${monthName} ${availableYear} Entry Class`;
}
