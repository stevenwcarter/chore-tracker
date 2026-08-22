import { useQuery } from '@apollo/client/react';
import { Balance } from 'types';
import { LIST_BALANCES_GQL } from './queries';
import { useErrorToast } from './useErrorToast';

interface ListallowanceResponse {
  getBalances: Balance[];
}

export const useBalances = () => {
  const { data, error } = useQuery<ListallowanceResponse>(LIST_BALANCES_GQL, {
    pollInterval: 5 * 60 * 1000,
  });

  useErrorToast(error, 'Error loading balances');

  const balances = data?.getBalances ?? [];
  return { balances };
};
