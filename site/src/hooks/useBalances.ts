import { useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Balance } from 'types';
import { LIST_BALANCES_GQL } from './queries';

interface ListallowanceResponse {
  getBalances: Balance[];
}

export const useBalances = () => {
  const [balances, setBalances] = useState<Balance[]>([]);
  const { data } = useQuery<ListallowanceResponse>(LIST_BALANCES_GQL, {
    pollInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data && data.getBalances) {
      setBalances(data.getBalances);
    }
  }, [data]);

  return { balances };
};
