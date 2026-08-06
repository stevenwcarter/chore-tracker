import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserBalance from '../UserBalance';

const balances = [{ name: 'Alice', balance: 12.5 }];

describe('UserBalance', () => {
  it('renders the YNAB balance in dollars', () => {
    render(<UserBalance name="Alice" balances={balances} />);
    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });

  // The balance arrives from YNAB in whole dollars and the pending figure arrives
  // from our database in cents. This assertion fails loudly on a 100x mixup.
  it('renders pending cents in parentheses', () => {
    render(<UserBalance name="Alice" balances={balances} pendingCents={200} />);
    expect(screen.getByText('($2.00)')).toBeInTheDocument();
  });

  it('renders no pending line when nothing is pending', () => {
    render(<UserBalance name="Alice" balances={balances} pendingCents={0} />);
    expect(screen.queryByText(/\(\$/)).not.toBeInTheDocument();
  });

  it('renders no pending line when the figure is absent', () => {
    render(<UserBalance name="Alice" balances={balances} />);
    expect(screen.queryByText(/\(\$/)).not.toBeInTheDocument();
  });

  it('leaves the balance line unaffected by the pending figure', () => {
    render(<UserBalance name="Alice" balances={balances} pendingCents={200} />);
    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });

  // `balances` comes from YNAB and is `[]` both on error and while in flight. The
  // pending figure comes entirely from our own database, so it must not disappear
  // just because YNAB is unavailable.
  it('renders the pending figure even when balances is empty', () => {
    render(<UserBalance name="Alice" balances={[]} pendingCents={200} />);
    expect(screen.getByText('($2.00)')).toBeInTheDocument();
  });

  it('renders the pending figure when the named kid is missing from a non-empty balances array', () => {
    const otherKidsBalances = [{ name: 'Bob', balance: 5 }];
    render(<UserBalance name="Alice" balances={otherKidsBalances} pendingCents={200} />);
    expect(screen.getByText('($2.00)')).toBeInTheDocument();
  });
});
