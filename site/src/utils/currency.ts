/**
 * Currency formatting, split by unit.
 *
 * Two entry points on purpose. Every money field in our own database and on the
 * GraphQL wire is in **cents**; the YNAB-sourced `Balance.balance` is in whole
 * **dollars** and is matched to a kid by name rather than id. A single
 * all-purpose formatter taking "an amount" invited passing one where the other
 * was meant, which silently misreports by a factor of 100.
 */
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Formats an amount given in **cents** (our database and GraphQL wire format). */
export function formatCents(amountCents: number): string {
  return USD.format(amountCents / 100);
}

/**
 * Formats an amount given in whole **dollars** (the YNAB balance figure).
 *
 * `zeroAs` renders a placeholder instead of `$0.00` — the balance line uses
 * `'-'` so an empty YNAB account reads as "nothing to show" rather than a
 * confident zero.
 */
export function formatDollars(amount: number, opts?: { zeroAs?: string }): string {
  if (amount === 0 && opts?.zeroAs !== undefined) {
    return opts.zeroAs;
  }
  return USD.format(amount);
}
