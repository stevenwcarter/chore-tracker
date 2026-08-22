import { WeekDateRange } from '../types/chore';

/**
 * Start of the week containing `date`, as a local-time, midnight-normalised
 * Date. Weeks are treated as **Sunday-start**: this is the value sent to the
 * backend as `weekStartDate`.
 *
 * Deliberately independent of the chore `requiredDays` bitmask, which is
 * Monday-first (see `utils/weekdayBitmask.ts`). The two answer different
 * questions — "which calendar week am I looking at" vs "which weekdays is
 * this chore scheduled for" — and must not be unified.
 */
function getWeekStartDate(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Subtract days since Sunday
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getWeekEndDate(weekStart: Date): Date {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

export function getWeekDateRange(date: Date = new Date()): WeekDateRange {
  const start = getWeekStartDate(date);
  const end = getWeekEndDate(start);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + i);
    dates.push(dayDate);
  }

  return { start, end, dates };
}

export function formatDateForGraphQL(date: Date): string {
  // Format date in local timezone to avoid UTC conversion issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Compares a Date against a GraphQL date string, which must be in `YYYY-MM-DD` form.
 *
 * The string is split and rebuilt as a local-time Date on purpose: `new Date(dateString)`
 * would parse it as UTC midnight and report the previous day in negative-offset timezones.
 */
export function isSameDayAsString(date: Date, dateString: string): boolean {
  // Parse the date string in local timezone to avoid UTC conversion
  const [year, month, day] = dateString.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day); // month is 0-indexed
  return isSameDay(date, parsedDate);
}

export function getNextWeek(currentWeekStart: Date): Date {
  const nextWeek = new Date(currentWeekStart);
  nextWeek.setDate(currentWeekStart.getDate() + 7);
  return nextWeek;
}

export function getPreviousWeek(currentWeekStart: Date): Date {
  const prevWeek = new Date(currentWeekStart);
  prevWeek.setDate(currentWeekStart.getDate() - 7);
  return prevWeek;
}
