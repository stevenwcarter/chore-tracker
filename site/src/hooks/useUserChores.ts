import { useMutation, useQuery } from '@apollo/client';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { ChoreCompletion, WeeklyChoreData, Chore } from 'types/chore';
import { GET_USER_CHORES, GET_WEEKLY_CHORES, CREATE_CHORE_COMPLETION } from 'graphql/queries';
import { formatDateForGraphQL } from 'utils/dateUtils';

interface UseUserChoresOptions {
  userId: number;
  weekStartDate: Date;
}

export const useUserChores = ({ userId, weekStartDate }: UseUserChoresOptions) => {
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
    fetchPolicy: 'cache-and-network',
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

  const weeklyChoreData = useMemo<WeeklyChoreData[]>(() => {
    if (!userChoresData?.listChores || !weeklyData?.getWeeklyChoreCompletions) return [];

    const completions: ChoreCompletion[] = weeklyData.getWeeklyChoreCompletions;
    const completionMap = new Map<number, ChoreCompletion[]>();
    completions.forEach((completion) => {
      const choreId = completion.choreId;
      if (!completionMap.has(choreId)) completionMap.set(choreId, []);
      completionMap.get(choreId)!.push({ ...completion, approved: completion.approved || false });
    });

    return userChoresData.listChores.map((backendChore: Chore) => ({
      chore: { ...backendChore },
      completions: completionMap.get(backendChore.id) ?? [],
    }));
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
      toast.error('Error completing chore');
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
