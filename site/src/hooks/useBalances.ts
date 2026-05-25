import { useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { toast } from 'react-toastify';
import { Balance } from 'types';
import { LIST_BALANCES_GQL } from './queries';

interface ListallowanceResponse {
  getBalances: Balance[];
}

export const useBalances = () => {
  const { data, error } = useQuery<ListallowanceResponse>(LIST_BALANCES_GQL, {
    pollInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (error) toast.error('Error loading balances');
  }, [error]);

  const balances = data?.getBalances ?? [];
  return { balances };
};
