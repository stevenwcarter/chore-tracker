import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import React from 'react';
import '@testing-library/jest-dom';
import { useCompletionActions } from '../useCompletionActions';
import { ADD_CHORE_NOTE } from 'graphql/queries';
import { ChoreCompletion, PaymentType, AuthorType } from 'types/chore';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn() },
}));

import { toast } from 'react-toastify';

const CHORE = {
  id: 1,
  uuid: 'chore-uuid-1',
  name: 'Take out trash',
  amountCents: 500,
  paymentType: PaymentType.Daily,
  requiredDays: 1,
  createdAt: '2026-01-01T00:00:00Z',
  createdByAdminId: 1,
};

const USER = {
  id: 5,
  uuid: 'user-uuid-5',
  name: 'Alice',
  createdAt: '2026-01-01T00:00:00Z',
};

const COMPLETION: ChoreCompletion = {
  id: 100,
  uuid: 'completion-uuid-100',
  choreId: 1,
  userId: 5,
  completedDate: '2026-08-01',
  approved: false,
  amountCents: 500,
  chore: CHORE,
  user: USER,
  notes: [],
  adminNotes: [],
};

function wrapper(mocks: MockedResponse[]) {
  return ({ children }: { children: React.ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// T52 made the kid-facing Add Note button admin-only by gating AddNoteForm on
// `isAdmin`, so `useCompletionActions`'s non-admin `addNote` branch
// (authorType: User / authorUserId, no authorAdminId) is no longer reachable
// through the UI. The branch itself is deliberately retained -- the hook is
// independently callable and deleting the branch is out of scope for
// T52/T39/T40 -- so it needs direct coverage here rather than through
// AddNoteForm/ChoreCompletionDetail, which can no longer exercise it.
//
// The mirror-image admin-branch assertion (authorType: Admin, authorAdminId
// set, no authorUserId) is already covered indirectly: ChoreCompletionDetail's
// "admin save: fires ADD_CHORE_NOTE with authorAdminId + visibleToUser from
// the checkbox..." test drives this same hook through the full component with
// isAdmin: true, and MockedProvider's exact-variables matching means that test
// would fail with "no more mocked responses" if the hook sent an authorUserId
// key or omitted authorAdminId. No separate direct-hook admin test is added.
describe('useCompletionActions addNote', () => {
  it('non-admin: fires ADD_CHORE_NOTE with authorUserId and no authorAdminId', async () => {
    const onUpdate = vi.fn();
    const onClose = vi.fn();
    const mocks: MockedResponse[] = [
      {
        request: {
          query: ADD_CHORE_NOTE,
          variables: {
            note: {
              choreCompletionId: COMPLETION.id,
              noteText: 'I did it early',
              authorType: AuthorType.User,
              authorUserId: 5,
              visibleToUser: true,
            },
          },
        },
        result: {
          data: {
            createChoreCompletionNote: {
              id: 10,
              uuid: 'note-10',
              noteText: 'I did it early',
              authorType: AuthorType.User,
              visibleToUser: true,
              createdAt: '2026-08-02T00:00:00Z',
            },
          },
        },
      },
    ];

    const { result } = renderHook(
      () =>
        useCompletionActions({
          completion: COMPLETION,
          isAdmin: false,
          userId: 5,
          onUpdate,
          onClose,
        }),
      { wrapper: wrapper(mocks) },
    );

    const saved = await result.current.addNote('I did it early', true);

    expect(saved).toBe(true);
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
