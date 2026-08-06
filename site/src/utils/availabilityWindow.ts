import type { AvailabilityWindow } from 'types/chore';

/**
 * Single source of truth for the chore availability-window encoding on the client.
 *
 * A window is an inclusive month/day range that repeats every year. Comparisons go
 * through an MMDD number (`month * 100 + day`), which sorts in calendar order and
 * so reduces the in-season question to a pair of integer comparisons - including
 * the wrap-the-new-year case.
 *
 * This mirrors `src/availability.rs` on the server. The two test tables are
 * deliberately identical; change one and you must change the other. The server is
 * the enforcement point (`ChoreCompletionSvc::create`); everything here is a UI
 * affordance.
 */

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const toMmdd = (month: number, day: number): number => month * 100 + day;

/** True when `date` falls inside `window`, inclusive at both ends. A null or
 *  absent window means the chore is available year round. Uses local time, to
 *  match the dates the weekly grid builds. */
export function isDateInWindow(window: AvailabilityWindow | null | undefined, date: Date): boolean {
  if (!window) return true;

  const day = toMmdd(date.getMonth() + 1, date.getDate());
  const start = toMmdd(window.startMonth, window.startDay);
  const end = toMmdd(window.endMonth, window.endDay);

  return start <= end ? start <= day && day <= end : day >= start || day <= end;
}

/** True when at least one of `dates` is in season. The weekly grid uses this to
 *  decide whether a chore's row belongs in the displayed week at all. */
export function isWeekInWindow(
  window: AvailabilityWindow | null | undefined,
  dates: Date[],
): boolean {
  if (!window) return true;
  return dates.some((date) => isDateInWindow(window, date));
}

/** Renders a window as `Sep 1 – Jun 15` for display. */
export function formatWindow(window: AvailabilityWindow): string {
  const label = (month: number, day: number) => `${MONTH_ABBREVIATIONS[month - 1]} ${day}`;
  return `${label(window.startMonth, window.startDay)} – ${label(window.endMonth, window.endDay)}`;
}
