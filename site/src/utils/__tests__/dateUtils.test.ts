import { describe, it, expect } from 'vitest';
import { formatDateForDisplay, formatDateParts } from '../dateUtils';

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
