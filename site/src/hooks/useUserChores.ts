import { useMutation, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { ChoreCompletion, WeeklyChoreData, Chore } from '../types/chore';
import { GET_USER_CHORES, GET_WEEKLY_CHORES, CREATE_CHORE_COMPLETION } from '../graphql/queries';
import { formatDateForGraphQL } from '../utils/dateUtils';

interface UseUserChoresOptions {
  userId: number;
  weekStartDate: Date;
}

export const useUserChores = ({ userId, weekStartDate }: UseUserChoresOptions) => {
  const [weeklyChoreData, setWeeklyChoreData] = useState<WeeklyChoreData[]>([]);

  // Fetch all chores assigned to the user
  const {
    data: userChoresData,
    loading: choresLoading,
    error: choresError,
  } = useQuery(GET_USER_CHORES, {
    variables: {
      userId,
    },
  });

  // Fetch completions for the week
  const {
    data: weeklyData,
    loading: weeklyLoading,
    error: weeklyError,
    refetch: refetchWeekly,
  } = useQuery(GET_WEEKLY_CHORES, {
    fetchPolicy: 'no-cache',
    variables: {
      userId,
      weekStartDate: formatDateForGraphQL(weekStartDate),
    },
    pollInterval: 30_000,
  });

  const [createChoreCompletion] = useMutation(CREATE_CHORE_COMPLETION, {
    onCompleted: () => {
      refetchWeekly();
    },
  });

  useEffect(() => {
    if (userChoresData?.listChores && weeklyData?.getWeeklyChoreCompletions) {
      const userChores = userChoresData.listChores;
      const completions: ChoreCompletion[] = weeklyData.getWeeklyChoreCompletions;

      // Create a map of completions by chore ID for quick lookup
      const completionMap = new Map<number, ChoreCompletion[]>();
      completions.forEach((completion) => {
        const choreId = completion.choreId;
        if (!completionMap.has(choreId)) {
          completionMap.set(choreId, []);
        }
        completionMap.get(choreId)!.push({
          ...completion,
          approved: completion.approved || false,
        });
      });

      // Transform user chores into WeeklyChoreData format
      const transformedData: WeeklyChoreData[] = userChores.map((backendChore: any) => {
        const chore: Chore = {
          id: backendChore.id,
          uuid: backendChore.uuid,
          name: backendChore.name,
          description: backendChore.description,
          amountCents: backendChore.amountCents,
          paymentType: backendChore.paymentType,
          requiredDays: backendChore.requiredDays,
          active: backendChore.active,
          createdAt: backendChore.createdAt,
          createdByAdminId: backendChore.createdByAdminId,
        };

        const choreCompletions = completionMap.get(chore.id) || [];

        return {
          chore,
          completions: choreCompletions,
        };
      });

      setWeeklyChoreData(transformedData);
    }
  }, [userChoresData, weeklyData]);

  const completeChore = async (choreId: number, completionDate: Date) => {
    try {
      const formattedDate = formatDateForGraphQL(completionDate);
      await createChoreCompletion({
        variables: {
          completion: {
            choreId,
            userId,
            completedDate: formattedDate,
          },
        },
      });
    } catch (err) {
      console.error('Error completing chore:', err);
      throw err;
    }
  };

  return {
    weeklyChoreData,
    loading: choresLoading || weeklyLoading,
    error: choresError || weeklyError,
    refetch: refetchWeekly,
    completeChore,
  };
};
