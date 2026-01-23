import { Balance } from 'types';

interface UserBalanceProps {
  name: string;
  balances: Balance[];
}

export const UserBalance = (props: UserBalanceProps) => {
  const { name, balances } = props;
  if (!balances || balances.length === 0) {
    return null;
  }

  const userBalance = balances.find((balance) => balance.name === name);

  if (!userBalance) {
    return null;
  }

  return <div className="text-sm text-white mt-1">${userBalance.balance}</div>;
};

export default UserBalance;
