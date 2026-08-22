import { Balance } from 'types';
import { formatCents, formatDollars } from 'utils/currency';

interface UserBalanceProps {
  name: string;
  balances: Balance[];
  /**
   * Money earned but not yet paid out, in **cents**.
   *
   * `balances` above are YNAB spending money in whole **dollars**, matched by
   * name; this is our own database's figure in cents, matched by user id. The two
   * use different formatters on purpose - do not merge them.
   */
  pendingCents?: number;
}

export const UserBalance = (props: UserBalanceProps) => {
  const { name, balances, pendingCents } = props;
  // `balances` comes from YNAB (an external API call, gated on a token) and is `[]`
  // both on error and while in flight - so its absence must NOT hide the pending
  // figure, which comes entirely from our own database. Only the balance line's
  // presence depends on `balances` having data; the pending line is independent.
  const hasBalances = !!balances && balances.length > 0;
  const hasPending = !!pendingCents;

  if (!hasBalances && !hasPending) {
    return null;
  }

  const userBalance = balances?.find((balance) => balance.name === name) || { balance: 0 };

  return (
    <div className="mt-1">
      {hasBalances && (
        <div className="text-sm text-white">
          {formatDollars(userBalance.balance, { zeroAs: '-' })}
        </div>
      )}
      {hasPending && (
        <div className="text-xs text-yellow-400" title="Earned, awaiting payout">
          ({formatCents(pendingCents)})
        </div>
      )}
    </div>
  );
};

export default UserBalance;
