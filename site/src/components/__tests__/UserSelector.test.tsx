import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import '@testing-library/jest-dom';
import UserSelector from '../UserSelector';
import { GET_ALL_USERS } from 'graphql/queries';
import { LIST_BALANCES_GQL, GET_PENDING_TOTALS } from 'hooks/queries';
import { User } from 'types/chore';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Users deliberately listed neither alphabetically nor in ascending-id order,
// so a wiring bug that pairs pending totals to users by array position (rather
// than by user.id) produces a DIFFERENT, wrong pairing instead of coincidentally
// matching.
const BOB: User = {
  id: 2,
  uuid: 'user-uuid-2',
  name: 'Bob',
  imagePath: '',
  createdAt: '2026-01-01T00:00:00Z',
};
const ALICE: User = {
  id: 1,
  uuid: 'user-uuid-1',
  name: 'Alice',
  imagePath: '',
  createdAt: '2026-01-01T00:00:00Z',
};
const CAROL: User = {
  id: 3,
  uuid: 'user-uuid-3',
  name: 'Carol',
  imagePath: '',
  createdAt: '2026-01-01T00:00:00Z',
};
const users = [BOB, ALICE, CAROL];

// YNAB balances, matched by NAME. Carol's is nonzero so her tile's balance
// line is distinguishable from "no balance" while she has nothing pending.
const balances = [
  { name: 'Alice', balance: 12.5 },
  { name: 'Bob', balance: 7 },
  { name: 'Carol', balance: 3.25 },
];

// Pending totals, matched by user ID, listed in yet another order (Alice
// before Bob, even though Bob comes first in `users`) and with amounts that
// don't coincide under a positional pairing either:
//   correct (by id):       Bob (id 2) -> $2.00, Alice (id 1) -> $5.50
//   wrong (by position):   Bob (pos 0) -> $5.50, Alice (pos 1) -> $2.00
// The two are swapped, so a positional or name-keyed regression fails loudly.
// Carol (id 3) has no entry at all - nothing pending.
const pendingTotals = [
  { amountCents: 550, user: { id: 1 } }, // Alice
  { amountCents: 200, user: { id: 2 } }, // Bob
];

function mocks(): MockedResponse[] {
  return [
    { request: { query: GET_ALL_USERS }, result: { data: { listUsers: users } } },
    { request: { query: LIST_BALANCES_GQL }, result: { data: { getBalances: balances } } },
    {
      request: { query: GET_PENDING_TOTALS },
      result: { data: { getPendingTotals: pendingTotals } },
    },
  ];
}

function renderSelector() {
  return render(
    <MockedProvider mocks={mocks()}>
      <UserSelector selectedUserId={null} onUserSelect={vi.fn()} />
    </MockedProvider>,
  );
}

/** The button tile for a given kid, scoped so assertions can't pass by accident. */
async function tileFor(name: string): Promise<HTMLElement> {
  const nameEl = await screen.findByText(name, { selector: 'span' });
  const button = nameEl.closest('button');
  if (!button) throw new Error(`Could not find tile button for ${name}`);
  return button;
}

describe('UserSelector', () => {
  it("puts each kid's pending figure on their OWN tile, not a neighbor's", async () => {
    renderSelector();

    // findByText (async, retrying) - both the users query AND the pending
    // totals query must resolve before this line has anything to find, and
    // under full-suite load that can take more than one microtask tick.
    const aliceTile = await tileFor('Alice');
    expect(await within(aliceTile).findByText('($5.50)')).toBeInTheDocument();
    expect(within(aliceTile).queryByText('($2.00)')).not.toBeInTheDocument();

    const bobTile = await tileFor('Bob');
    expect(await within(bobTile).findByText('($2.00)')).toBeInTheDocument();
    expect(within(bobTile).queryByText('($5.50)')).not.toBeInTheDocument();
  });

  it('renders no pending line for a kid absent from getPendingTotals, but still shows their balance', async () => {
    renderSelector();

    const carolTile = await tileFor('Carol');
    expect(await within(carolTile).findByText('$3.25')).toBeInTheDocument();
    expect(within(carolTile).queryByText(/\(\$/)).not.toBeInTheDocument();
  });
});
