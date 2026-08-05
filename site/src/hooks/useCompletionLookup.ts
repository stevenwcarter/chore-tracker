import { useMemo } from 'react';
import { ChoreCompletion } from 'types/chore';
import { formatDateForGraphQL } from 'utils/dateUtils';

interface AllWeeklyCompletionsData {
  getAllWeeklyCompletions?: ChoreCompletion[];
}

/**
 * Builds an O(1) "who completed what, when" index from the all-users weekly
 * completions query, and exposes the two predicates the chore grid and bonus
 * chore section use to grey out already-completed cells/claims.
 *
 * `isChoreCompletedByUser` recomputes `formatDateForGraphQL(date)` inside its
 * predicate and linearly scans `allCompletionsData` rather than using the
 * Set-backed lookup below -- moved here unchanged from `WeeklyChoreView`, not
 * optimised.
 */
export function useCompletionLookup(allCompletionsData?: AllWeeklyCompletionsData) {
  // Build a Set keyed by "choreId-YYYY-MM-DD" for O(1) per-cell lookup
  const completionLookup = useMemo(() => {
    const set = new Set<string>();
    allCompletionsData?.getAllWeeklyCompletions?.forEach((c: ChoreCompletion) => {
      set.add(`${c.choreId}-${c.completedDate}`);
    });
    return set;
  }, [allCompletionsData]);

  const isChoreCompletedByAnyone = (choreId: number, date: Date): boolean => {
    return completionLookup.has(`${choreId}-${formatDateForGraphQL(date)}`);
  };

  const isChoreCompletedByUser = (choreId: number, userId: number, date: Date): boolean => {
    return (
      allCompletionsData?.getAllWeeklyCompletions?.some(
        (c: ChoreCompletion) =>
          c.choreId === choreId &&
          c.userId === userId &&
          c.completedDate === formatDateForGraphQL(date),
      ) ?? false
    );
  };

  return { isChoreCompletedByAnyone, isChoreCompletedByUser };
}

export default useCompletionLookup;
