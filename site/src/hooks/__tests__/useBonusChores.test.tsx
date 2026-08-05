import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import React from 'react';
import '@testing-library/jest-dom';
import { useBonusChores } from '../useBonusChores';
import { LIST_BONUS_CHORES, CREATE_BONUS_CHORE } from 'graphql/queries';
import { PaymentType } from 'types/chore';
import { print } from 'graphql';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn() },
}));

import { toast } from 'react-toastify';

const TODAY = '2026-04-16';

function wrapper(mocks: MockedResponse[]) {
  return ({ children }: { children: React.ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useBonusChores', () => {
  it('returns empty array when query succeeds with no bonus chores', async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: LIST_BONUS_CHORES, variables: { date: TODAY } },
        result: { data: { listBonusChores: [] } },
      },
    ];

    const { result } = renderHook(() => useBonusChores(TODAY), { wrapper: wrapper(mocks) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.bonusChores).toEqual([]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('returns bonus chores when query succeeds with data', async () => {
    const chore = {
      id: 1,
      uuid: 'abc-123',
      name: 'Clean the garage',
      description: null,
      paymentType: 'daily',
      amountCents: 500,
      bonusDate: TODAY,
      maxClaims: null,
    };

    const mocks: MockedResponse[] = [
      {
        request: { query: LIST_BONUS_CHORES, variables: { date: TODAY } },
        result: { data: { listBonusChores: [chore] } },
      },
    ];

    const { result } = renderHook(() => useBonusChores(TODAY), { wrapper: wrapper(mocks) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.bonusChores).toHaveLength(1);
    expect(result.current.bonusChores[0].name).toBe('Clean the garage');
  });

  it('shows error toast and returns empty array when query fails', async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: LIST_BONUS_CHORES, variables: { date: TODAY } },
        result: { errors: [new GraphQLError('Internal error')] },
      },
    ];

    const { result } = renderHook(() => useBonusChores(TODAY), { wrapper: wrapper(mocks) });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    expect(toast.error).toHaveBeenCalledWith('Error loading bonus chores');
    expect(result.current.bonusChores).toEqual([]);
  });
});

describe('CREATE_BONUS_CHORE contract', () => {
  it('names its argument `chore`, matching Mutation::create_bonus_chore', () => {
    const doc = print(CREATE_BONUS_CHORE);
    expect(doc).toContain('$chore: ChoreInput!');
    expect(doc).toContain('createBonusChore(chore: $chore)');
    expect(doc).not.toContain('$input');
  });

  it('creates a bonus chore with the DAILY enum value', async () => {
    const chore = {
      uuid: null,
      name: 'Sweep the porch',
      description: null,
      paymentType: PaymentType.Daily,
      amountCents: 250,
      requiredDays: 0,
      active: true,
      createdByAdminId: 1,
      bonusDate: TODAY,
      maxClaims: 2,
    };

    const mocks: MockedResponse[] = [
      {
        request: { query: LIST_BONUS_CHORES, variables: { date: TODAY } },
        result: { data: { listBonusChores: [] } },
      },
      {
        request: { query: CREATE_BONUS_CHORE, variables: { chore } },
        result: {
          data: {
            createBonusChore: {
              id: 7,
              uuid: 'bonus-7',
              name: 'Sweep the porch',
              bonusDate: TODAY,
              maxClaims: 2,
            },
          },
        },
      },
      {
        request: { query: LIST_BONUS_CHORES, variables: { date: TODAY } },
        result: { data: { listBonusChores: [] } },
      },
    ];

    const { result } = renderHook(() => useBonusChores(TODAY), { wrapper: wrapper(mocks) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.createBonusChore(chore);

    await waitFor(() => expect(toast.error).not.toHaveBeenCalled());
  });
});
