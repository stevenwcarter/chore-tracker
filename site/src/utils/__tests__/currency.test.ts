import { describe, it, expect } from 'vitest';
import { formatCents, formatDollars } from '../currency';

describe('formatCents', () => {
  it('renders cents as dollars', () => {
    expect(formatCents(150)).toBe('$1.50');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(123456)).toBe('$1,234.56');
  });

  it('does not treat zero specially', () => {
    // The pending-earnings line relies on 0 rendering as a real amount.
    expect(formatCents(0)).not.toBe('-');
  });
});

describe('formatDollars', () => {
  it('renders whole dollars', () => {
    expect(formatDollars(12)).toBe('$12.00');
    expect(formatDollars(1234.5)).toBe('$1,234.50');
  });

  it('substitutes zeroAs when the amount is zero', () => {
    expect(formatDollars(0, { zeroAs: '-' })).toBe('-');
  });

  it('renders zero normally when zeroAs is not given', () => {
    expect(formatDollars(0)).toBe('$0.00');
  });
});

describe('the two units are not interchangeable', () => {
  it('reads the same number differently by a factor of 100', () => {
    // Guards the merge this split exists to prevent: YNAB balances are whole
    // dollars, every database money field is cents.
    expect(formatCents(1200)).toBe('$12.00');
    expect(formatDollars(1200)).toBe('$1,200.00');
  });
});
