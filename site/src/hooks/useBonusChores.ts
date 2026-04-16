import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'react-toastify';
import { Chore } from 'types/chore';
import { LIST_BONUS_CHORES, CREATE_BONUS_CHORE } from 'graphql/queries';

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
  const {
    data,
    loading,
    refetch,
  } = useQuery<{ listBonusChores: Chore[] }>(LIST_BONUS_CHORES, {
    variables: { date },
    onError: () => toast.error('Error loading bonus chores'),
  });

  const [createMutation, { loading: creating }] = useMutation(CREATE_BONUS_CHORE, {
    onCompleted: () => {
      refetch();
    },
  });

  const createBonusChore = async (input: CreateBonusChoreInput): Promise<void> => {
    try {
      await createMutation({ variables: { input } });
    } catch (error) {
      toast.error('Error creating bonus chore');
      throw error;
    }
  };

  return {
    bonusChores: data?.listBonusChores ?? [],
    loading,
    createBonusChore,
    creating,
  };
};
