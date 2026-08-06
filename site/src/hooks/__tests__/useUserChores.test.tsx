import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { useUserChores } from '../useUserChores';
import { GET_USER_CHORES, GET_WEEKLY_CHORES } from 'graphql/queries';
import { PaymentType } from 'types/chore';
import { formatDateForGraphQL } from 'utils/dateUtils';

const SCHOOL_CHORE = {
  id: 1,
  uuid: 'chore-1',
  name: 'Study spelling',
  description: null,
  paymentType: PaymentType.Daily,
  amountCents: 100,
  requiredDays: 127,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  availabilityWindow: { startMonth: 9, startDay: 1, endMonth: 6, endDay: 15 },
};

const YEAR_ROUND_CHORE = {
  ...SCHOOL_CHORE,
  id: 2,
  uuid: 'chore-2',
  name: 'Make bed',
  availabilityWindow: null,
};

const mocks = (weekStart: Date): MockedResponse[] => [
  {
    request: { query: GET_USER_CHORES, variables: { userId: 1 } },
    result: { data: { listChores: [SCHOOL_CHORE, YEAR_ROUND_CHORE] } },
  },
  {
    request: {
      query: GET_WEEKLY_CHORES,
      variables: { userId: 1, weekStartDate: formatDateForGraphQL(weekStart) },
    },
    result: { data: { getWeeklyChoreCompletions: [] } },
  },
];

const renderForWeek = (weekStart: Date) =>
  renderHook(() => useUserChores({ userId: 1, weekStartDate: weekStart }), {
    wrapper: ({ children }) => <MockedProvider mocks={mocks(weekStart)}>{children}</MockedProvider>,
  });

describe('useUserChores availability window', () => {
  it('keeps a seasonal chore during a fully in-season week', async () => {
    const { result } = renderForWeek(new Date(2026, 9, 4)); // week of Oct 4 2026
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.weeklyChoreData.map((d) => d.chore.name)).toEqual([
      'Study spelling',
      'Make bed',
    ]);
  });

  it('keeps a seasonal chore during a boundary week', async () => {
    const { result } = renderForWeek(new Date(2027, 5, 13)); // week containing Jun 15 2027
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.weeklyChoreData.map((d) => d.chore.name)).toContain('Study spelling');
  });

  it('drops a seasonal chore when the whole week is out of season', async () => {
    const { result } = renderForWeek(new Date(2027, 6, 5)); // week of Jul 5 2027
    await waitFor(() => expect(result.current.loading).toBe(false));

    const names = result.current.weeklyChoreData.map((d) => d.chore.name);
    expect(names).not.toContain('Study spelling');
    expect(names).toContain('Make bed');
  });
});
