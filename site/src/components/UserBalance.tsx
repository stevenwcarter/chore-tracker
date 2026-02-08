import { Balance } from 'types';

interface UserBalanceProps {
  name: string;
  balances: Balance[];
}

const formatCurrency = (amount: number, currency = 'USD', locale = 'en-US') => {
  if (amount === 0) {
    return '-';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

export const UserBalance = (props: UserBalanceProps) => {
  const { name, balances } = props;
  if (!balances || balances.length === 0) {
    return null;
  }

  const userBalance = balances.find((balance) => balance.name === name) || { balance: 0 };

  return <div className="text-sm text-white mt-1">{formatCurrency(userBalance.balance)}</div>;
};

export default UserBalance;
