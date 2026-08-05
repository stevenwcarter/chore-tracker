import { describe, it, expect } from 'vitest';
import {
  WEEKDAY_BITS,
  DAY_NAMES,
  bitmaskFromDayNames,
  dayNamesFromBitmask,
  isDayInBitmask,
} from '../weekdayBitmask';

describe('weekdayBitmask', () => {
  it('places Monday at bit 0 and Sunday at bit 6, matching the backend', () => {
    expect(WEEKDAY_BITS.Monday).toBe(1);
    expect(WEEKDAY_BITS.Tuesday).toBe(2);
    expect(WEEKDAY_BITS.Wednesday).toBe(4);
    expect(WEEKDAY_BITS.Thursday).toBe(8);
    expect(WEEKDAY_BITS.Friday).toBe(16);
    expect(WEEKDAY_BITS.Saturday).toBe(32);
    expect(WEEKDAY_BITS.Sunday).toBe(64);
  });

  it('matches the backend day_patterns fixtures', () => {
    // src/test_helpers.rs: mon_wed_fri() == 21, weekdays() == 31, every_day() == 127
    expect(bitmaskFromDayNames(['Monday', 'Wednesday', 'Friday'])).toBe(21);
    expect(bitmaskFromDayNames(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])).toBe(31);
    expect(bitmaskFromDayNames([...DAY_NAMES])).toBe(127);
  });

  it('round-trips names through the mask', () => {
    for (const days of [
      [] as const,
      ['Monday'] as const,
      ['Saturday', 'Sunday'] as const,
      ['Monday', 'Wednesday', 'Friday'] as const,
    ]) {
      const mask = bitmaskFromDayNames([...days]);
      expect(dayNamesFromBitmask(mask)).toEqual([...days]);
    }
  });

  it('resolves a real Date against the mask', () => {
    // 2026-08-03 is a Monday; 2026-08-09 is a Sunday.
    const monday = new Date(2026, 7, 3);
    const sunday = new Date(2026, 7, 9);

    expect(isDayInBitmask(WEEKDAY_BITS.Monday, monday)).toBe(true);
    expect(isDayInBitmask(WEEKDAY_BITS.Monday, sunday)).toBe(false);
    expect(isDayInBitmask(WEEKDAY_BITS.Sunday, sunday)).toBe(true);
  });

  it('treats 0 as no scheduled days', () => {
    expect(dayNamesFromBitmask(0)).toEqual([]);
    expect(isDayInBitmask(0, new Date(2026, 7, 3))).toBe(false);
  });
});
