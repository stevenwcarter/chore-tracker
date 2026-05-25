import { useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { toast } from 'react-toastify';
import { Chore } from 'types/chore';
import { LIST_BONUS_CHORES, CREATE_BONUS_CHORE } from 'graphql/queries';
import { withErrorToast } from 'utils/withErrorToast';
import { useRefetchingMutation } from './useRefetchingMutation';

interface CreateBonusChoreInput {
  name: string;
  description?: string | null;
  paymentType: string;
  amountCents: number;
  requiredDays: number;
  active: boolean;
  createdByAdminId: number;
  bonusDate: string; // ISO 8601 YYYY-MM-DD
  maxClaims?: number | null;
}

interface UseBonusChoresResult {
  bonusChores: Chore[];
  loading: boolean;
  createBonusChore: (input: CreateBonusChoreInput) => Promise<void>;
  creating: boolean;
}

export const useBonusChores = (date: string): UseBonusChoresResult => {
  const { data, loading, error, refetch } = useQuery<{ listBonusChores: Chore[] }>(
    LIST_BONUS_CHORES,
    { variables: { date } },
  );

  useEffect(() => {
    if (error) toast.error('Error loading bonus chores');
  }, [error]);

  const [createMutation, { loading: creating }] = useRefetchingMutation(
    CREATE_BONUS_CHORE,
    refetch,
  );

  const createBonusChore = async (input: CreateBonusChoreInput): Promise<void> => {
    await withErrorToast('Error creating bonus chore', () =>
      createMutation({ variables: { input } }),
    );
  };

  return {
    bonusChores: data?.listBonusChores ?? [],
    loading,
    createBonusChore,
    creating,
  };
};
