import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import '@testing-library/jest-dom';
import ChoreCompletionDetail from '../ChoreCompletionDetail';
import { ADD_CHORE_NOTE, APPROVE_CHORE_COMPLETION, DELETE_CHORE_COMPLETION } from 'graphql/queries';
import { ChoreCompletion, PaymentType, AuthorType } from 'types/chore';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from 'react-toastify';

// Fixture data. Two notes: one visible to the user, one admin-only. This lets
// us pin the client-side `isAdmin || note.visibleToUser` filter, which is a
// DISPLAY concern layered on top of server-side filtering (T14 fixed the real
// leak server-side) -- an admin viewer must still see both notes and the
// "Admin Only" badge; a non-admin viewer must see only the visible one.
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

const USER_VISIBLE_NOTE = {
  id: 1,
  choreCompletionId: 100,
  noteText: 'Great job!',
  authorType: AuthorType.Admin,
  authorAdminId: 1,
  visibleToUser: true,
  createdAt: '2026-01-05T10:00:00Z',
};

const ADMIN_ONLY_NOTE = {
  id: 2,
  choreCompletionId: 100,
  noteText: 'Needs a reminder about lid placement',
  authorType: AuthorType.Admin,
  authorAdminId: 1,
  visibleToUser: false,
  createdAt: '2026-01-05T11:00:00Z',
};

const BASE_COMPLETION: ChoreCompletion = {
  id: 100,
  uuid: 'completion-uuid-100',
  choreId: 1,
  userId: 5,
  completedDate: '2026-08-01',
  approved: false,
  amountCents: 500,
  chore: CHORE,
  user: USER,
  notes: [USER_VISIBLE_NOTE, ADMIN_ONLY_NOTE],
  adminNotes: [],
};

function renderCompletion(
  props: Partial<{
    completion: ChoreCompletion;
    isAdmin?: boolean;
    adminId?: number;
    userId?: number;
  }> = {},
  mocks: MockedResponse[] = [],
) {
  const onClose = vi.fn();
  const onUpdate = vi.fn();
  const utils = render(
    <MockedProvider mocks={mocks}>
      <ChoreCompletionDetail
        completion={BASE_COMPLETION}
        onClose={onClose}
        onUpdate={onUpdate}
        {...props}
      />
    </MockedProvider>,
  );
  return { ...utils, onClose, onUpdate };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChoreCompletionDetail summary', () => {
  it('renders pending status, chore, user, date, and formatted amount', () => {
    renderCompletion();

    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    expect(screen.getByText('Take out trash')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('2026-08-01')).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
  });

  it('renders "Approved" status text when completion.approved is true', () => {
    renderCompletion({ completion: { ...BASE_COMPLETION, approved: true } });

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByText('Pending Approval')).not.toBeInTheDocument();
  });

  it('omits the Chore/User rows when absent, without crashing', () => {
    renderCompletion({
      completion: {
        ...BASE_COMPLETION,
        chore: undefined as unknown as ChoreCompletion['chore'],
        user: undefined as unknown as ChoreCompletion['user'],
      },
    });

    expect(screen.queryByText('Chore:')).not.toBeInTheDocument();
    expect(screen.queryByText('User:')).not.toBeInTheDocument();
    // The rest of the summary still renders.
    expect(screen.getByText('$5.00')).toBeInTheDocument();
  });
});

describe('ChoreCompletionDetail admin approval controls', () => {
  it('shows Approve/Reject only for an admin viewer with a pending completion', () => {
    renderCompletion({ isAdmin: true, adminId: 1 });

    expect(screen.getByRole('button', { name: /Approve/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/ })).toBeInTheDocument();
  });

  it('hides Approve/Reject for a non-admin viewer', () => {
    renderCompletion({ isAdmin: false });

    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/ })).not.toBeInTheDocument();
  });

  it('hides Approve/Reject once the completion is already approved, even for an admin', () => {
    renderCompletion({ isAdmin: true, completion: { ...BASE_COMPLETION, approved: true } });

    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/ })).not.toBeInTheDocument();
  });

  it('approves: fires APPROVE_CHORE_COMPLETION and calls onUpdate then onClose', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: APPROVE_CHORE_COMPLETION,
          variables: { completionUuid: BASE_COMPLETION.uuid },
        },
        result: {
          data: {
            approveChoreCompletion: {
              id: 100,
              uuid: BASE_COMPLETION.uuid,
              approved: true,
              approvedAt: '2026-08-02T00:00:00Z',
              approvedByAdminId: 1,
            },
          },
        },
      },
    ];
    const { onUpdate, onClose } = renderCompletion({ isAdmin: true, adminId: 1 }, mocks);

    await userEvent.click(screen.getByRole('button', { name: /Approve/ }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('approve failure shows toast.error and does not call onUpdate/onClose', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: APPROVE_CHORE_COMPLETION,
          variables: { completionUuid: BASE_COMPLETION.uuid },
        },
        result: { errors: [new GraphQLError('boom')] },
      },
    ];
    const { onUpdate, onClose } = renderCompletion({ isAdmin: true, adminId: 1 }, mocks);

    await userEvent.click(screen.getByRole('button', { name: /Approve/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error approving completion'));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('rejects: confirms, fires DELETE_CHORE_COMPLETION, and calls onUpdate then onClose', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    const mocks: MockedResponse[] = [
      {
        request: {
          query: DELETE_CHORE_COMPLETION,
          variables: { completionUuid: BASE_COMPLETION.uuid },
        },
        result: { data: { deleteChoreCompletion: true } },
      },
    ];
    const { onUpdate, onClose } = renderCompletion({ isAdmin: true, adminId: 1 }, mocks);

    await userEvent.click(screen.getByRole('button', { name: /Reject/ }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reject: does nothing when the confirm dialog is dismissed', async () => {
    const confirmMock = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmMock);
    const { onUpdate, onClose } = renderCompletion({ isAdmin: true, adminId: 1 }, []);

    await userEvent.click(screen.getByRole('button', { name: /Reject/ }));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reject failure shows toast.error and does not call onUpdate/onClose', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    const mocks: MockedResponse[] = [
      {
        request: {
          query: DELETE_CHORE_COMPLETION,
          variables: { completionUuid: BASE_COMPLETION.uuid },
        },
        result: { errors: [new GraphQLError('boom')] },
      },
    ];
    const { onUpdate, onClose } = renderCompletion({ isAdmin: true, adminId: 1 }, mocks);

    await userEvent.click(screen.getByRole('button', { name: /Reject/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error rejecting completion'));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ChoreCompletionDetail notes display', () => {
  it('admin viewer sees every note, including an "Admin Only" badge on notes not visible to the user', () => {
    renderCompletion({ isAdmin: true, adminId: 1 });

    expect(screen.getByText('Great job!')).toBeInTheDocument();
    expect(screen.getByText('Needs a reminder about lid placement')).toBeInTheDocument();
    expect(screen.getByText('Admin Only')).toBeInTheDocument();
  });

  it('non-admin viewer sees only notes marked visibleToUser, with no "Admin Only" badge', () => {
    renderCompletion({ isAdmin: false, userId: 5 });

    expect(screen.getByText('Great job!')).toBeInTheDocument();
    expect(screen.queryByText('Needs a reminder about lid placement')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin Only')).not.toBeInTheDocument();
  });

  it('renders no Notes section when there are no notes', () => {
    renderCompletion({ completion: { ...BASE_COMPLETION, notes: [] } });

    expect(screen.queryByText('Notes:')).not.toBeInTheDocument();
  });
});

describe('ChoreCompletionDetail add note', () => {
  // T52: `createChoreCompletionNote` requires an admin session server-side, so
  // AddNoteForm now gates the whole control on `isAdmin` - a non-admin viewer
  // gets no Add Note button at all (previously it rendered unconditionally).
  it('shows the Add Note button for an admin viewer', () => {
    renderCompletion({ isAdmin: true, adminId: 1 });

    expect(screen.getByRole('button', { name: /Add Note/ })).toBeInTheDocument();
  });

  it('hides the Add Note button entirely for a non-admin viewer', () => {
    renderCompletion({ isAdmin: false });

    expect(screen.queryByRole('button', { name: /Add Note/ })).not.toBeInTheDocument();
  });

  it('admin sees a "Visible to user" checkbox, checked by default, after opening the form', async () => {
    renderCompletion({ isAdmin: true, adminId: 1 });

    await userEvent.click(screen.getByRole('button', { name: /Add Note/ }));

    expect(screen.getByRole('checkbox', { name: /Visible to user/ })).toBeChecked();
  });

  it('Cancel hides the form and clears the note text', async () => {
    renderCompletion({ isAdmin: true, adminId: 1 });

    await userEvent.click(screen.getByRole('button', { name: /Add Note/ }));
    await userEvent.type(screen.getByPlaceholderText('Add a note...'), 'draft note');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByPlaceholderText('Add a note...')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Add Note/ }));
    expect(screen.getByPlaceholderText('Add a note...')).toHaveValue('');
  });

  it('does not fire a mutation when Save is clicked with blank/whitespace-only text', async () => {
    // No mocks configured: if a request were attempted, MockedProvider would
    // reject with "no more mocked responses" and the catch block would toast.
    renderCompletion({ isAdmin: true, adminId: 1 }, []);

    await userEvent.click(screen.getByRole('button', { name: /Add Note/ }));
    await userEvent.type(screen.getByPlaceholderText('Add a note...'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByPlaceholderText('Add a note...')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('admin save: fires ADD_CHORE_NOTE with authorAdminId + visibleToUser from the checkbox, then clears/closes the form and calls onUpdate', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: ADD_CHORE_NOTE,
          variables: {
            note: {
              choreCompletionId: BASE_COMPLETION.id,
              noteText: 'Nice work',
              authorType: AuthorType.Admin,
              authorAdminId: 1,
              visibleToUser: false,
            },
          },
        },
        result: {
          data: {
            createChoreCompletionNote: {
              id: 9,
              uuid: 'note-9',
              noteText: 'Nice work',
              authorType: AuthorType.Admin,
              visibleToUser: false,
              createdAt: '2026-08-02T00:00:00Z',
            },
          },
        },
      },
    ];
    const { onUpdate } = renderCompletion({ isAdmin: true, adminId: 1 }, mocks);

    await userEvent.click(screen.getByRole('button', { name: /Add Note/ }));
    await userEvent.type(screen.getByPlaceholderText('Add a note...'), 'Nice work');
    await userEvent.click(screen.getByRole('checkbox', { name: /Visible to user/ })); // uncheck -> false
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(screen.queryByPlaceholderText('Add a note...')).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  // Pins the two halves of the "successful save" state-reset behaviour that
  // the previous test's `.not.toBeInTheDocument()` check can't distinguish
  // from a no-op: the whole form is conditionally rendered on `isAddingNote`,
  // so "the textarea is gone" alone proves the form closed but says nothing
  // about whether `noteText` was actually cleared. Reopening the form after
  // a successful save is the only way to observe both: the draft text is
  // cleared, but (per the pre-existing quirk carried over verbatim from the
  // original component) the visibility checkbox is NOT reset to its
  // checked-by-default state -- only Cancel does that.
  it('admin: reopening the form after a successful save shows cleared text but a NOT-reset visibility checkbox', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: ADD_CHORE_NOTE,
          variables: {
            note: {
              choreCompletionId: BASE_COMPLETION.id,
              noteText: 'Reopen check',
              authorType: AuthorType.Admin,
              authorAdminId: 1,
              visibleToUser: false,
            },
          },
        },
        result: {
          data: {
            createChoreCompletionNote: {
              id: 11,
              uuid: 'note-11',
              noteText: 'Reopen check',
              authorType: AuthorType.Admin,
              visibleToUser: false,
              createdAt: '2026-08-02T00:00:00Z',
            },
          },
        },
      },
    ];
    renderCompletion({ isAdmin: true, adminId: 1 }, mocks);

    await userEvent.click(screen.getByRole('button', { name: /Add Note/ }));
    await userEvent.type(screen.getByPlaceholderText('Add a note...'), 'Reopen check');
    await userEvent.click(screen.getByRole('checkbox', { name: /Visible to user/ })); // uncheck -> false
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Add a note...')).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /Add Note/ }));

    expect(screen.getByPlaceholderText('Add a note...')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: /Visible to user/ })).not.toBeChecked();
  });

  it('add-note failure shows toast.error and leaves the form open', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: ADD_CHORE_NOTE,
          variables: {
            note: {
              choreCompletionId: BASE_COMPLETION.id,
              noteText: 'oops',
              authorType: AuthorType.Admin,
              authorAdminId: 1,
              visibleToUser: true,
            },
          },
        },
        result: { errors: [new GraphQLError('boom')] },
      },
    ];
    renderCompletion({ isAdmin: true, adminId: 1 }, mocks);

    await userEvent.click(screen.getByRole('button', { name: /Add Note/ }));
    await userEvent.type(screen.getByPlaceholderText('Add a note...'), 'oops');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error adding note'));
    expect(screen.getByPlaceholderText('Add a note...')).toBeInTheDocument();
  });
});
