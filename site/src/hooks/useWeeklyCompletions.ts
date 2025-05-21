import { useMutation, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { ChoreCompletion } from '../types/chore';
import {
  GET_ALL_WEEKLY_COMPLETIONS,
  APPROVE_CHORE_COMPLETION,
  ADD_CHORE_NOTE,
  DELETE_CHORE_COMPLETION,
} from '../graphql/queries';
import { formatDateForGraphQL } from '../utils/dateUtils';

interface UseWeeklyCompletionsOptions {
  weekStartDate: Date;
}

export const useWeeklyCompletions = ({ weekStartDate }: UseWeeklyCompletionsOptions) => {
  const [completions, setCompletions] = useState<ChoreCompletion[]>([]);

  const { data, loading, error, refetch } = useQuery(GET_ALL_WEEKLY_COMPLETIONS, {
    variables: {
      weekStartDate: formatDateForGraphQL(weekStartDate),
    },
  });

  const [approveChoreCompletion] = useMutation(APPROVE_CHORE_COMPLETION, {
    onCompleted: () => {
      refetch();
    },
  });

  const [addChoreNote] = useMutation(ADD_CHORE_NOTE, {
    onCompleted: () => {
      refetch();
    },
  });

  const [deleteChoreCompletion] = useMutation(DELETE_CHORE_COMPLETION, {
    onCompleted: () => {
      refetch();
    },
  });

  useEffect(() => {
    if (data && data.getAllWeeklyCompletions) {
      setCompletions(data.getAllWeeklyCompletions);
    }
  }, [data]);

  const approveCompletion = async (completionUuid: string, adminId: number) => {
    try {
      await approveChoreCompletion({
        variables: {
          completionUuid,
          adminId: adminId,
        },
      });
    } catch (err) {
      console.error('Error approving completion:', err);
      throw err;
    }
  };

  const deleteCompletion = async (completionUuid: string) => {
    try {
      await deleteChoreCompletion({
        variables: {
          completionUuid,
        },
      });
    } catch (err) {
      console.error('Error deleting completion:', err);
      throw err;
    }
  };

  const addNote = async (noteData: any) => {
    try {
      await addChoreNote({
        variables: {
          note: noteData,
        },
      });
    } catch (err) {
      console.error('Error adding note:', err);
      throw err;
    }
  };

  const pendingCompletions = completions.filter((c) => !c.approved);
  const approvedCompletions = completions.filter((c) => c.approved);

  return {
    completions,
    pendingCompletions,
    approvedCompletions,
    loading,
    error,
    refetch,
    approveCompletion,
    deleteCompletion,
    addNote,
  };
};
