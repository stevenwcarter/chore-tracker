import { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_PENDING_TOTALS } from './queries';
import { useErrorToast } from './useErrorToast';

interface PendingTotal {
  amountCents: number;
  user: { id: number };
}

interface PendingTotalsResponse {
  getPendingTotals: PendingTotal[];
}

/**
 * Per-user money earned but not yet paid out, in **cents**, keyed by user id.
 *
 * Note the contrast with `useBalances`, which returns YNAB spending money in
 * whole **dollars** keyed by **name**. The landing page shows both, so keep the
 * two straight.
 *
 * Polls every 30s - matching `useUserChores` - so a kid who completes a chore
 * sees the figure move without reloading.
 */
export const usePendingTotals = () => {
  const { data, error } = useQuery<PendingTotalsResponse>(GET_PENDING_TOTALS, {
    pollInterval: 30_000,
  });

  useErrorToast(error, 'Error loading pending totals');

  const pendingByUserId = useMemo(() => {
    const map = new Map<number, number>();
    (data?.getPendingTotals ?? []).forEach((total) => map.set(total.user.id, total.amountCents));
    return map;
  }, [data]);

  return { pendingByUserId };
};
