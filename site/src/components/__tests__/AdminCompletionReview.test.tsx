import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import '@testing-library/jest-dom';
import AdminCompletionReview from '../AdminCompletionReview';
import {
  GET_ALL_WEEKLY_COMPLETIONS,
  APPROVE_CHORE_COMPLETION,
  DELETE_CHORE_COMPLETION,
} from 'graphql/queries';
import { ChoreCompletion, Chore, User, PaymentType } from 'types/chore';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from 'react-toastify';

// The mocked "now" is Wed 2026-08-05 (matches the sandbox's real clock at the
// time this suite was written, but pinned via fake timers so the test is not
// sensitive to whatever day it actually runs). Weeks are Sunday-start, so:
//   current week:  Sun 2026-08-02 - Sat 2026-08-08
//   previous week: Sun 2026-07-26 - Sat 2026-08-01
const CURRENT_WEEK_START = '2026-08-02';
const PREVIOUS_WEEK_START = '2026-07-26';
const CURRENT_WEEK_RANGE_TEXT = 'Week of Sun, Aug 2 - Sat, Aug 8';
const PREVIOUS_WEEK_RANGE_TEXT = 'Week of Sun, Jul 26 - Sat, Aug 1';

const CHORE_TRASH: Chore = {
  id: 10,
  uuid: 'chore-uuid-10',
  name: 'Take out trash',
  amountCents: 500,
  paymentType: PaymentType.Daily,
  requiredDays: 1,
  createdAt: '2026-01-01T00:00:00Z',
  createdByAdminId: 1,
};

const USER_ALICE: User = {
  id: 20,
  uuid: 'user-uuid-20',
  name: 'Alice',
  createdAt: '2026-01-01T00:00:00Z',
};

// Pending completions never carry an approvedAt in practice (the mutation that
// sets it hasn't run yet). CompletionCard does not rely on that data invariant,
// though -- it gates the approval line on `completion.approved` explicitly (see
// the "suppresses the approval date on a pending completion that carries one"
// test below), so this fixture is just the ordinary shape, not a guarantee the
// component trusts.
const PENDING_COMPLETION: ChoreCompletion = {
  id: 100,
  uuid: 'completion-uuid-100',
  choreId: 10,
  userId: 20,
  completedDate: '2026-08-03',
  approved: false,
  amountCents: 500,
  chore: CHORE_TRASH,
  user: USER_ALICE,
  notes: [],
  adminNotes: [],
};

const APPROVED_COMPLETION: ChoreCompletion = {
  id: 101,
  uuid: 'completion-uuid-101',
  choreId: 10,
  userId: 20,
  completedDate: '2026-08-01',
  approved: true,
  approvedAt: '2026-08-02T09:00:00Z',
  amountCents: 500,
  chore: CHORE_TRASH,
  user: USER_ALICE,
  notes: [],
  adminNotes: [],
};

function weeklyCompletionsMock(
  weekStartDate: string,
  completions: ChoreCompletion[],
): MockedResponse {
  return {
    request: {
      query: GET_ALL_WEEKLY_COMPLETIONS,
      variables: { weekStartDate },
    },
    result: { data: { getAllWeeklyCompletions: completions } },
  };
}

function renderComponent(
  extraMocks: MockedResponse[] = [],
  initialCompletions: ChoreCompletion[] = [PENDING_COMPLETION, APPROVED_COMPLETION],
) {
  return render(
    <MockedProvider
      mocks={[weeklyCompletionsMock(CURRENT_WEEK_START, initialCompletions), ...extraMocks]}
    >
      <AdminCompletionReview adminId={1} />
    </MockedProvider>,
  );
}

async function waitForLoaded() {
  await screen.findByText('Completion Review');
}

beforeEach(() => {
  vi.clearAllMocks();
  // Only Date is faked; setTimeout/rAF stay real so userEvent/waitFor behave normally.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-05T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AdminCompletionReview pending completions', () => {
  it('renders chore, user, amount, and View/Approve/Reject controls, with no approvedAt line', async () => {
    renderComponent([], [PENDING_COMPLETION]);
    await waitForLoaded();

    expect(screen.getByText('Pending Approval (1)')).toBeInTheDocument();
    expect(screen.getByText('Take out trash')).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/ })).toBeInTheDocument();
    expect(screen.queryByText(/Approved:/)).not.toBeInTheDocument();

    // Pins the ONE cosmetic delta this task's refactor must preserve: the
    // pending card's action buttons stack vertically at md+ widths.
    const approveButton = screen.getByRole('button', { name: /Approve/ });
    expect(approveButton.parentElement).not.toBeNull();
    expect((approveButton.parentElement as HTMLElement).className).toBe('flex md:flex-col gap-2');

    // The other list is genuinely empty, not merely unrendered.
    expect(screen.getByText('Approved This Week (0)')).toBeInTheDocument();
    expect(screen.getByText('No approved completions for this week.')).toBeInTheDocument();
  });

  it('approve: fires APPROVE_CHORE_COMPLETION with the completion uuid, then refetches and moves it into Approved', async () => {
    const refetched = [
      {
        ...PENDING_COMPLETION,
        approved: true,
        approvedAt: '2026-08-05T12:00:00.000Z',
      },
    ];
    renderComponent(
      [
        {
          request: {
            query: APPROVE_CHORE_COMPLETION,
            variables: { completionUuid: PENDING_COMPLETION.uuid },
          },
          result: {
            data: {
              approveChoreCompletion: {
                id: PENDING_COMPLETION.id,
                uuid: PENDING_COMPLETION.uuid,
                approved: true,
                approvedAt: '2026-08-05T12:00:00.000Z',
                approvedByAdminId: 1,
              },
            },
          },
        },
        weeklyCompletionsMock(CURRENT_WEEK_START, refetched),
      ],
      [PENDING_COMPLETION],
    );
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Approve/ }));

    await waitFor(() => expect(screen.getByText('Approved This Week (1)')).toBeInTheDocument());
    expect(screen.getByText('Pending Approval (0)')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('approve failure shows toast.error and leaves the completion pending', async () => {
    renderComponent(
      [
        {
          request: {
            query: APPROVE_CHORE_COMPLETION,
            variables: { completionUuid: PENDING_COMPLETION.uuid },
          },
          result: { errors: [new GraphQLError('boom')] },
        },
      ],
      [PENDING_COMPLETION],
    );
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Approve/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error approving completion'));
    expect(screen.getByText('Pending Approval (1)')).toBeInTheDocument();
  });

  it('reject: confirms, fires DELETE_CHORE_COMPLETION, then refetches and removes the completion', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    renderComponent(
      [
        {
          request: {
            query: DELETE_CHORE_COMPLETION,
            variables: { completionUuid: PENDING_COMPLETION.uuid },
          },
          result: { data: { deleteChoreCompletion: true } },
        },
        weeklyCompletionsMock(CURRENT_WEEK_START, []),
      ],
      [PENDING_COMPLETION],
    );
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Reject/ }));

    await waitFor(() => expect(screen.getByText('Pending Approval (0)')).toBeInTheDocument());
    expect(screen.getByText('No pending completions for this week.')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reject: does nothing when the confirm dialog is dismissed', async () => {
    const confirmMock = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmMock);
    renderComponent([], [PENDING_COMPLETION]);
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Reject/ }));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    // No mock was registered for DELETE_CHORE_COMPLETION -- if the component had
    // attempted the mutation anyway, MockedProvider would reject it and the catch
    // block would toast an error. A clean pending list plus no toast proves it didn't.
    expect(screen.getByText('Pending Approval (1)')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reject failure shows toast.error and the completion stays pending', async () => {
    // NOTE [T26]: message text changed from 'Error rejecting completion' to
    // 'Error deleting completion' -- the component now delegates to the
    // shared useWeeklyCompletions hook, whose deleteCompletion wraps
    // withErrorToast('Error deleting completion', ...). This is the hook's
    // pre-existing message (it had zero importers before this task), not a
    // new choice made here.
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    renderComponent(
      [
        {
          request: {
            query: DELETE_CHORE_COMPLETION,
            variables: { completionUuid: PENDING_COMPLETION.uuid },
          },
          result: { errors: [new GraphQLError('boom')] },
        },
      ],
      [PENDING_COMPLETION],
    );
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Reject/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error deleting completion'));
    expect(screen.getByText('Pending Approval (1)')).toBeInTheDocument();
  });
});

describe('AdminCompletionReview approved completions', () => {
  it('renders chore, user, amount, and only a View Details control (no Approve/Reject)', async () => {
    renderComponent([], [APPROVED_COMPLETION]);
    await waitForLoaded();

    expect(screen.getByText('Approved This Week (1)')).toBeInTheDocument();
    expect(screen.getByText('Take out trash')).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/ })).not.toBeInTheDocument();

    expect(screen.getByText('Pending Approval (0)')).toBeInTheDocument();
    expect(screen.getByText('No pending completions for this week.')).toBeInTheDocument();
  });

  it('renders the approval date on an approved completion', async () => {
    // GET_ALL_WEEKLY_COMPLETIONS now selects `approvedAt` (see
    // src/graphql/queries.ts) -- this pins the previously-broken behaviour:
    // CompletionCard's `{completion.approvedAt && <p>Approved: ...</p>}` guard
    // now actually renders for data delivered through this query. [T104]
    renderComponent([], [APPROVED_COMPLETION]);
    await waitForLoaded();

    expect(await screen.findByText(/Approved:/)).toBeInTheDocument();
  });

  it('suppresses the approval date on a pending completion that carries one', async () => {
    // The backend never actually produces this combination today (approved_at
    // is only written alongside approved = true, and "reject" is a delete, so
    // there is no unapprove path) -- constructing it here is the point: it is
    // exactly what CompletionCard's gate must not trust incidental invariants
    // to prevent. [T105]
    const pendingWithApprovedAt: ChoreCompletion = {
      ...PENDING_COMPLETION,
      approved: false,
      approvedAt: '2026-08-03T12:00:00',
    };
    renderComponent([], [pendingWithApprovedAt]);
    await waitForLoaded();

    // The pending card must be on screen...
    expect(await screen.findByRole('button', { name: /Approve/ })).toBeInTheDocument();
    // ...and must NOT show an approval date.
    expect(screen.queryByText(/Approved:/)).not.toBeInTheDocument();
  });
});

describe('AdminCompletionReview completion detail modal', () => {
  it('View Details opens the Completion Details modal; the close button clears it', async () => {
    renderComponent([], [PENDING_COMPLETION]);
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: 'View Details' }));

    expect(screen.getByRole('heading', { name: 'Completion Details' })).toBeInTheDocument();
    expect(screen.getByText('Chore:')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    expect(screen.queryByRole('heading', { name: 'Completion Details' })).not.toBeInTheDocument();
  });
});

describe('AdminCompletionReview week navigation', () => {
  it('shows the current week range on load', async () => {
    renderComponent([], []);
    await waitForLoaded();

    expect(screen.getByText(CURRENT_WEEK_RANGE_TEXT)).toBeInTheDocument();
  });

  it('Previous moves back one week, refetches, and updates the displayed range', async () => {
    renderComponent([weeklyCompletionsMock(PREVIOUS_WEEK_START, [])], []);
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Previous/ }));

    await waitFor(() => expect(screen.getByText(PREVIOUS_WEEK_RANGE_TEXT)).toBeInTheDocument());
  });

  it('This Week resets back to the current week after navigating away', async () => {
    renderComponent(
      [
        weeklyCompletionsMock(PREVIOUS_WEEK_START, []),
        weeklyCompletionsMock(CURRENT_WEEK_START, []),
      ],
      [],
    );
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Previous/ }));
    await waitFor(() => expect(screen.getByText(PREVIOUS_WEEK_RANGE_TEXT)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'This Week' }));

    await waitFor(() => expect(screen.getByText(CURRENT_WEEK_RANGE_TEXT)).toBeInTheDocument());
  });
});

describe('AdminCompletionReview loading and error states', () => {
  it('shows an inline error message when the query fails', async () => {
    render(
      <MockedProvider
        mocks={[
          {
            request: {
              query: GET_ALL_WEEKLY_COMPLETIONS,
              variables: { weekStartDate: CURRENT_WEEK_START },
            },
            result: { errors: [new GraphQLError('boom')] },
          },
        ]}
      >
        <AdminCompletionReview adminId={1} />
      </MockedProvider>,
    );

    await waitFor(() => expect(screen.getByText(/Error loading completions/)).toBeInTheDocument());
  });
});

describe('AdminCompletionReview background polling', () => {
  it('keeps the completions on screen while a background poll is still in flight', async () => {
    // Full fake timers (not just Date) so we can advance past the 30s
    // pollInterval on useWeeklyCompletions without a real 30-second wait.
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-08-05T12:00:00'));

    renderComponent(
      [
        {
          // The poll's own response. An explicit 5s delay - much longer than
          // the 30s+100ms we advance below - guarantees this fetch is still
          // in flight at the point we assert, i.e. exactly the window where
          // Apollo Client 4's notifyOnNetworkStatusChange default (true)
          // would otherwise flip `loading` back to true mid-poll.
          request: {
            query: GET_ALL_WEEKLY_COMPLETIONS,
            variables: { weekStartDate: CURRENT_WEEK_START },
          },
          result: { data: { getAllWeeklyCompletions: [PENDING_COMPLETION] } },
          delay: 5_000,
        },
      ],
      [PENDING_COMPLETION],
    );

    // Let the initial load settle.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByText('Completion Review')).toBeInTheDocument();
    expect(screen.getByText('Take out trash')).toBeInTheDocument();

    // Cross the 30s poll interval. The poll's request is still in flight (it
    // won't resolve for another ~5s per the mock above).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    // A background poll must not blank the page: the content should still be
    // rendered, not replaced by the full-page loading spinner.
    expect(screen.getByText('Completion Review')).toBeInTheDocument();
    expect(screen.getByText('Take out trash')).toBeInTheDocument();
  });
});
