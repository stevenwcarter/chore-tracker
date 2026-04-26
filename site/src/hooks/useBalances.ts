import { useQuery } from '@apollo/client';
import { Balance } from 'types';
import { LIST_BALANCES_GQL } from './queries';

interface ListallowanceResponse {
  getBalances: Balance[];
}

export const useBalances = () => {
  const { data } = useQuery<ListallowanceResponse>(LIST_BALANCES_GQL, {
    pollInterval: 5 * 60 * 1000,
  });
  const balances = data?.getBalances ?? [];
  return { balances };
};
