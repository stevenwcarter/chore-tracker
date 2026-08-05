/**
 * Single source of truth for the chore `requiredDays` weekday bitmask.
 *
 * Monday = bit 0 (1) through Sunday = bit 6 (64). This matches the Rust
 * backend (`PaymentType::get_assigned_days_count`), `src/test_helpers.rs`
 * (`days_bitmask`), and CLAUDE.md.
 *
 * Note this is deliberately independent of the *week start* convention:
 * `getWeekStartDate` in `dateUtils.ts` is Sunday-start. The two answer
 * different questions and must not be unified.
 */
export const WEEKDAY_BITS = {
  Monday: 1 << 0,
  Tuesday: 1 << 1,
  Wednesday: 1 << 2,
  Thursday: 1 << 3,
  Friday: 1 << 4,
  Saturday: 1 << 5,
  Sunday: 1 << 6,
} as const;

export type DayName = keyof typeof WEEKDAY_BITS;

/** Weekday names in mask-bit order, Monday first. */
export const DAY_NAMES = Object.keys(WEEKDAY_BITS) as DayName[];

/** Encodes a set of weekday names into a `requiredDays` mask. */
export function bitmaskFromDayNames(names: DayName[]): number {
  return names.reduce((acc, name) => acc | WEEKDAY_BITS[name], 0);
}

/** Decodes a `requiredDays` mask into weekday names, Monday first. */
export function dayNamesFromBitmask(mask: number): DayName[] {
  return DAY_NAMES.filter((name) => (mask & WEEKDAY_BITS[name]) !== 0);
}

/** True when `date`'s weekday is set in `mask`. Uses local time. */
export function isDayInBitmask(mask: number, date: Date): boolean {
  const mondayBasedIndex = (date.getDay() + 6) % 7;
  return (mask & (1 << mondayBasedIndex)) !== 0;
}
