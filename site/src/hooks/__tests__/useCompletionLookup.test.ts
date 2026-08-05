import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCompletionLookup } from '../useCompletionLookup';

// 2026-08-03 is a Monday. Constructed in local time to match
// formatDateForGraphQL, which is deliberately local-time based.
const MONDAY = new Date(2026, 7, 3);
const TUESDAY = new Date(2026, 7, 4);

const data = {
  getAllWeeklyCompletions: [
    { choreId: 1, userId: 10, completedDate: '2026-08-03' },
    { choreId: 2, userId: 20, completedDate: '2026-08-03' },
  ],
} as never;

describe('useCompletionLookup', () => {
  it('reports a chore the given user completed on the given day', () => {
    const { result } = renderHook(() => useCompletionLookup(data));
    expect(result.current.isChoreCompletedByUser(1, 10, MONDAY)).toBe(true);
  });

  it('does not report a chore completed by a DIFFERENT user', () => {
    const { result } = renderHook(() => useCompletionLookup(data));
    expect(result.current.isChoreCompletedByUser(1, 20, MONDAY)).toBe(false);
  });

  it('does not report a DIFFERENT chore completed by the same user', () => {
    const { result } = renderHook(() => useCompletionLookup(data));
    expect(result.current.isChoreCompletedByUser(2, 10, MONDAY)).toBe(false);
  });

  it('does not report the same chore and user on a different day', () => {
    const { result } = renderHook(() => useCompletionLookup(data));
    expect(result.current.isChoreCompletedByUser(1, 10, TUESDAY)).toBe(false);
  });

  it('returns false when there is no completion data at all', () => {
    const { result } = renderHook(() => useCompletionLookup(undefined));
    expect(result.current.isChoreCompletedByUser(1, 10, MONDAY)).toBe(false);
  });
});
