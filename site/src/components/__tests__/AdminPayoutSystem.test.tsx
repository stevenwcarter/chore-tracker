import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import '@testing-library/jest-dom';
import AdminPayoutSystem from '../AdminPayoutSystem';
import { GET_UNPAID_TOTALS, MARK_COMPLETIONS_AS_PAID } from 'graphql/queries';
import { UnpaidTotal } from 'types/chore';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from 'react-toastify';

// Fixture data. Amounts are integer cents on the wire:
//   Alice: $12.00 (1200), Bob: $3.50 (350), Carol: $0.00 (0, no unpaid chores).
// Total unpaid across all users = 1200 + 350 + 0 = 1550 cents = $15.50.
// "Users with Unpaid Chores" only counts users with amountCents > 0, so 2 (Alice, Bob) -
// Carol is excluded from both that count and from "Select All".
const ALICE_UNPAID: UnpaidTotal = {
  user: {
    id: 1,
    uuid: 'user-uuid-1',
    name: 'Alice',
    imagePath: undefined,
    createdAt: '2026-01-01T00:00:00Z',
  },
  amountCents: 1200,
};
const BOB_UNPAID: UnpaidTotal = {
  user: {
    id: 2,
    uuid: 'user-uuid-2',
    name: 'Bob',
    imagePath: undefined,
    createdAt: '2026-01-01T00:00:00Z',
  },
  amountCents: 350,
};
const CAROL_UNPAID: UnpaidTotal = {
  user: {
    id: 3,
    uuid: 'user-uuid-3',
    name: 'Carol',
    imagePath: undefined,
    createdAt: '2026-01-01T00:00:00Z',
  },
  amountCents: 0,
};
const unpaidTotals = [ALICE_UNPAID, BOB_UNPAID, CAROL_UNPAID];

function unpaidTotalsMock(data: UnpaidTotal[] = unpaidTotals): MockedResponse {
  return {
    request: { query: GET_UNPAID_TOTALS },
    result: { data: { getUnpaidTotals: data } },
  };
}

function renderComponent(extraMocks: MockedResponse[] = []) {
  return render(
    <MockedProvider mocks={[unpaidTotalsMock(), ...extraMocks]}>
      <AdminPayoutSystem adminId={1} />
    </MockedProvider>,
  );
}

async function waitForLoaded() {
  await screen.findByText('Payout System');
}

function usersWithUnpaidChoresCount(): HTMLElement {
  const heading = screen.getByText('Users with Unpaid Chores');
  const card = heading.closest('div') as HTMLElement;
  const p = card.querySelector('p');
  if (!p) throw new Error('Could not find count paragraph for Users with Unpaid Chores card');
  return p;
}

function selectedForPayoutAmount(): HTMLElement {
  const heading = screen.getByText('Selected for Payout');
  const card = heading.closest('div') as HTMLElement;
  const p = card.querySelector('p');
  if (!p) throw new Error('Could not find amount paragraph for Selected for Payout card');
  return p;
}

// "Total Outstanding" is rendered twice (page header + summary card), each as a label
// element immediately followed by a sibling <p> holding the formatted amount. Scoping to
// these two labels (rather than a bare getAllByText on the currency string) avoids false
// matches against an unrelated row that happens to show the same dollar amount.
function totalOutstandingAmounts(): string[] {
  return screen.getAllByText('Total Outstanding').map((label) => {
    const amount = label.nextElementSibling;
    if (!amount) throw new Error('Could not find amount element next to Total Outstanding label');
    return amount.textContent ?? '';
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminPayoutSystem summary figures', () => {
  it('computes total unpaid, non-zero user count, and zero selected total on load', async () => {
    renderComponent();
    await waitForLoaded();

    // Users with Unpaid Chores excludes Carol (amountCents === 0): 2 users.
    expect(usersWithUnpaidChoresCount()).toHaveTextContent('2');

    // Total unpaid across ALL users (including Carol's $0) = 1200 + 350 + 0 = $15.50.
    // Rendered in both the header and the "Total Outstanding" summary card.
    expect(totalOutstandingAmounts()).toEqual(['$15.50', '$15.50']);

    // Nothing selected yet.
    expect(selectedForPayoutAmount()).toHaveTextContent('$0.00');
  });

  it('updates the selected-users subtotal as selection changes, in integer cents', async () => {
    renderComponent();
    await waitForLoaded();

    // Toggle Alice on: selected total = 1200 cents = $12.00.
    const aliceRow = screen
      .getByText('Alice')
      .closest('div[class*="rounded-lg border"]') as HTMLElement;
    const aliceCheckboxInput = aliceRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await userEvent.click(aliceCheckboxInput);
    expect(selectedForPayoutAmount()).toHaveTextContent('$12.00');

    // Toggle Bob on too: selected total = 1200 + 350 = 1550 cents = $15.50.
    const bobRow = screen
      .getByText('Bob')
      .closest('div[class*="rounded-lg border"]') as HTMLElement;
    const bobCheckboxInput = bobRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await userEvent.click(bobCheckboxInput);
    expect(selectedForPayoutAmount()).toHaveTextContent('$15.50');

    // Toggle Alice back off: selected total = 350 cents = $3.50 (Bob only).
    await userEvent.click(aliceCheckboxInput);
    expect(selectedForPayoutAmount()).toHaveTextContent('$3.50');
  });

  it('Select All selects every non-zero-balance user (excludes Carol); Clear All empties the selection', async () => {
    renderComponent();
    await waitForLoaded();

    await userEvent.click(screen.getByRole('button', { name: 'Select All' }));

    expect(selectedForPayoutAmount()).toHaveTextContent('$15.50');
    expect(screen.getByText('Selected: 2 users')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear All' }));

    expect(selectedForPayoutAmount()).toHaveTextContent('$0.00');
    // The Payout Actions panel is only rendered while selectedUsers.length > 0.
    expect(screen.queryByRole('heading', { name: 'Process Payout' })).not.toBeInTheDocument();
  });
});

describe('AdminPayoutSystem nothing selected', () => {
  it('renders no Payout Actions panel and no way to trigger a payout when the selection is empty', async () => {
    renderComponent();
    await waitForLoaded();

    // The rest of the screen is fully rendered...
    expect(usersWithUnpaidChoresCount()).toHaveTextContent('2');
    expect(selectedForPayoutAmount()).toHaveTextContent('$0.00');
    // ...but with nothing selected, there is no Payout Actions panel at all.
    expect(screen.queryByRole('heading', { name: 'Process Payout' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Process Payout/ })).not.toBeInTheDocument();
  });
});

describe('AdminPayoutSystem process payout', () => {
  it('fires the payout mutation with EXACTLY the selected user ids, then clears the selection on success', async () => {
    // Only Bob (id 2) selected -> the mutation mock only matches userIds: [2].
    // If the component sent all ids, or an empty list, MockedProvider would have
    // no matching mock and the mutation would fail (surfacing as an error toast),
    // so a passing test proves the ids sent were exactly [2].
    const refetchedTotals = [ALICE_UNPAID, { ...BOB_UNPAID, amountCents: 0 }, CAROL_UNPAID];
    renderComponent([
      {
        request: { query: MARK_COMPLETIONS_AS_PAID, variables: { userIds: [2] } },
        result: { data: { markCompletionsAsPaid: true } },
      },
      // onCompleted calls refetch(), which reissues GET_UNPAID_TOTALS.
      unpaidTotalsMock(refetchedTotals),
    ]);
    await waitForLoaded();

    const bobRow = screen
      .getByText('Bob')
      .closest('div[class*="rounded-lg border"]') as HTMLElement;
    const bobCheckboxInput = bobRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await userEvent.click(bobCheckboxInput);
    expect(selectedForPayoutAmount()).toHaveTextContent('$3.50');

    await userEvent.click(screen.getByRole('button', { name: /Process Payout/ }));

    // Refetch landed: total outstanding drops from $15.50 to $12.00 (Bob now $0).
    await waitFor(() => expect(totalOutstandingAmounts()).toEqual(['$12.00', '$12.00']));
    // Selection was cleared by onCompleted -> the Payout Actions panel is gone again.
    expect(screen.queryByRole('heading', { name: 'Process Payout' })).not.toBeInTheDocument();
    expect(selectedForPayoutAmount()).toHaveTextContent('$0.00');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows an error toast and stops the processing spinner when the mutation fails', async () => {
    renderComponent([
      {
        request: { query: MARK_COMPLETIONS_AS_PAID, variables: { userIds: [1] } },
        result: { errors: [new GraphQLError('boom')] },
      },
    ]);
    await waitForLoaded();

    const aliceRow = screen
      .getByText('Alice')
      .closest('div[class*="rounded-lg border"]') as HTMLElement;
    const aliceCheckboxInput = aliceRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await userEvent.click(aliceCheckboxInput);

    await userEvent.click(screen.getByRole('button', { name: /Process Payout/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error processing payout'));
    // Selection was NOT cleared (onCompleted never ran) - Alice is still selected.
    expect(selectedForPayoutAmount()).toHaveTextContent('$12.00');
    // Button re-enabled (isProcessingPayout reset), no longer shows the spinner.
    expect(screen.getByRole('button', { name: /Process Payout/ })).not.toBeDisabled();
  });
});
