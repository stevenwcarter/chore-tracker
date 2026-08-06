import { describe, it, expect } from 'vitest';
import { isDateInWindow, formatWindow, isWeekInWindow } from '../availabilityWindow';
import type { AvailabilityWindow } from 'types/chore';

const window = (
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number,
): AvailabilityWindow => ({ startMonth, startDay, endMonth, endDay });

/** Local-time date, matching how the weekly grid builds its dates. */
const date = (year: number, month: number, day: number) => new Date(year, month - 1, day);

describe('isDateInWindow', () => {
  it('treats a missing window as always available', () => {
    expect(isDateInWindow(null, date(2026, 7, 4))).toBe(true);
    expect(isDateInWindow(undefined, date(2026, 7, 4))).toBe(true);
  });

  // Summer-only chore: the window sits inside one calendar year.
  describe('non-wrapping window (Jun 1 - Aug 31)', () => {
    const w = window(6, 1, 8, 31);

    it('includes a mid-window day', () => expect(isDateInWindow(w, date(2026, 7, 4))).toBe(true));
    it('includes the start day', () => expect(isDateInWindow(w, date(2026, 6, 1))).toBe(true));
    it('includes the end day', () => expect(isDateInWindow(w, date(2026, 8, 31))).toBe(true));
    it('excludes the day before', () => expect(isDateInWindow(w, date(2026, 5, 31))).toBe(false));
    it('excludes the day after', () => expect(isDateInWindow(w, date(2026, 9, 1))).toBe(false));
    it('excludes a date far outside the window', () =>
      expect(isDateInWindow(w, date(2026, 1, 15))).toBe(false));
  });

  // School year: the window wraps the new year.
  describe('wrapping window (Sep 1 - Jun 15)', () => {
    const w = window(9, 1, 6, 15);

    it('includes the start day', () => expect(isDateInWindow(w, date(2026, 9, 1))).toBe(true));
    it('includes autumn', () => expect(isDateInWindow(w, date(2026, 10, 20))).toBe(true));
    it('includes Dec 31', () => expect(isDateInWindow(w, date(2026, 12, 31))).toBe(true));
    it('includes Jan 1', () => expect(isDateInWindow(w, date(2027, 1, 1))).toBe(true));
    it('includes spring', () => expect(isDateInWindow(w, date(2027, 3, 10))).toBe(true));
    it('includes the end day', () => expect(isDateInWindow(w, date(2027, 6, 15))).toBe(true));
    it('excludes the day after the end', () =>
      expect(isDateInWindow(w, date(2027, 6, 16))).toBe(false));
    it('excludes summer', () => expect(isDateInWindow(w, date(2027, 7, 4))).toBe(false));
    it('excludes the day before the start', () =>
      expect(isDateInWindow(w, date(2027, 8, 31))).toBe(false));
  });

  describe('single-day window', () => {
    const w = window(3, 14, 3, 14);

    it('includes the day', () => expect(isDateInWindow(w, date(2026, 3, 14))).toBe(true));
    it('excludes the day before', () => expect(isDateInWindow(w, date(2026, 3, 13))).toBe(false));
    it('excludes the day after', () => expect(isDateInWindow(w, date(2026, 3, 15))).toBe(false));
  });
});

describe('isWeekInWindow', () => {
  const w = window(9, 1, 6, 15);
  const weekFrom = (year: number, month: number, day: number) =>
    Array.from({ length: 7 }, (_, i) => date(year, month, day + i));

  it('is true when every day of the week is in season', () => {
    expect(isWeekInWindow(w, weekFrom(2026, 10, 5))).toBe(true);
  });

  it('is true when only some days of the week are in season', () => {
    // Jun 14-20 2027 straddles the Jun 15 end boundary.
    expect(isWeekInWindow(w, weekFrom(2027, 6, 14))).toBe(true);
  });

  it('is false when the whole week is out of season', () => {
    expect(isWeekInWindow(w, weekFrom(2027, 7, 6))).toBe(false);
  });

  it('is true for a missing window', () => {
    expect(isWeekInWindow(null, weekFrom(2027, 7, 6))).toBe(true);
  });
});

describe('formatWindow', () => {
  it('renders a readable range', () => {
    expect(formatWindow(window(9, 1, 6, 15))).toBe('Sep 1 – Jun 15');
    expect(formatWindow(window(6, 1, 8, 31))).toBe('Jun 1 – Aug 31');
    expect(formatWindow(window(12, 25, 12, 25))).toBe('Dec 25 – Dec 25');
  });
});
