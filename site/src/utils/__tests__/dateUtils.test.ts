import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatDateForDisplay,
  formatDateParts,
  getDefaultDateForWeek,
  getWeekDateRange,
  isToday,
} from '../dateUtils';

describe('formatDateParts', () => {
  it('splits a date into a short weekday and a short month/day', () => {
    expect(formatDateParts(new Date(2026, 8, 6))).toEqual({
      weekday: 'Sun',
      monthDay: 'Sep 6',
    });
  });

  it('does not pad the day number', () => {
    expect(formatDateParts(new Date(2026, 8, 12)).monthDay).toBe('Sep 12');
  });

  it('covers every weekday of a week', () => {
    const weekdays = Array.from(
      { length: 7 },
      (_, i) => formatDateParts(new Date(2026, 8, 6 + i)).weekday,
    );
    expect(weekdays).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  // The stacked grid header and the one-line callers (WeekNavigator, DayNavigator,
  // AdminCompletionReview, the mobile header) must stay independent: joining the
  // parts reproduces the one-line form, so neither can drift without this failing.
  it('joins back into the one-line form used everywhere else', () => {
    const date = new Date(2026, 8, 6);
    const { weekday, monthDay } = formatDateParts(date);
    expect(`${weekday}, ${monthDay}`).toBe(formatDateForDisplay(date));
  });
});

describe('isToday', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 7, 13, 30));
  });

  afterEach(() => vi.useRealTimers());

  it('is true for any time on the current calendar day', () => {
    expect(isToday(new Date(2026, 8, 7, 0, 0, 0))).toBe(true);
    expect(isToday(new Date(2026, 8, 7, 13, 30))).toBe(true);
    expect(isToday(new Date(2026, 8, 7, 23, 59, 59))).toBe(true);
  });

  it('is false for the surrounding days', () => {
    expect(isToday(new Date(2026, 8, 6, 23, 59, 59))).toBe(false);
    expect(isToday(new Date(2026, 8, 8, 0, 0, 0))).toBe(false);
  });

  // The grid dates come from getWeekDateRange, which normalises to local
  // midnight. Comparing by calendar day rather than by timestamp is what makes
  // a midnight-normalised date match a "now" that is midday.
  it('matches the midnight-normalised dates the week grid actually renders', () => {
    const { dates } = getWeekDateRange(new Date(2026, 8, 7));
    expect(dates.map(isToday)).toEqual([false, true, false, false, false, false, false]);
  });

  // Same calendar day number in a different month or year is a different day.
  it('does not match the same day number in another month or year', () => {
    expect(isToday(new Date(2026, 7, 7))).toBe(false);
    expect(isToday(new Date(2025, 8, 7))).toBe(false);
  });
});

describe('getDefaultDateForWeek', () => {
  // Mon 2026-09-07, so the containing Sunday-start week is Sun 2026-09-06 ..
  // Sat 2026-09-12 and today sits at index 1 -- not index 0, which is what makes
  // "opens on today" distinguishable from the old "opens on the week's first day".
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 7, 13, 30));
  });

  afterEach(() => vi.useRealTimers());

  it('returns today when the week contains it', () => {
    const { dates } = getWeekDateRange(new Date(2026, 8, 7));
    expect(getDefaultDateForWeek(dates)).toBe(dates[1]);
  });

  it('falls back to the first day for a week that does not contain today', () => {
    const past = getWeekDateRange(new Date(2026, 7, 12)).dates;
    const future = getWeekDateRange(new Date(2026, 9, 14)).dates;

    expect(getDefaultDateForWeek(past)).toBe(past[0]);
    expect(getDefaultDateForWeek(future)).toBe(future[0]);
  });

  // The day navigator finds its position with `dates.findIndex`, so a result
  // outside the array would leave it stuck with both buttons disabled.
  it('always returns one of the days it was given', () => {
    for (const seed of [new Date(2026, 8, 7), new Date(2026, 7, 12), new Date(2026, 9, 14)]) {
      const { dates } = getWeekDateRange(seed);
      expect(dates).toContain(getDefaultDateForWeek(dates));
    }
  });
});
