import { useMutation, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { ChoreCompletion, ChoreCompletionNoteInput } from 'types/chore';
import {
  GET_ALL_WEEKLY_COMPLETIONS,
  APPROVE_CHORE_COMPLETION,
  ADD_CHORE_NOTE,
  DELETE_CHORE_COMPLETION,
} from 'graphql/queries';
import { formatDateForGraphQL } from 'utils/dateUtils';

interface UseWeeklyCompletionsOptions {
  weekStartDate: Date;
}

export const useWeeklyCompletions = ({ weekStartDate }: UseWeeklyCompletionsOptions) => {
  const [completions, setCompletions] = useState<ChoreCompletion[]>([]);

  const { data, loading, error, refetch } = useQuery(GET_ALL_WEEKLY_COMPLETIONS, {
    fetchPolicy: 'cache-and-network',
    variables: {
      weekStartDate: formatDateForGraphQL(weekStartDate),
    },
    pollInterval: 30_000,
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
      toast.error('Error approving completion');
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
      toast.error('Error deleting completion');
      throw err;
    }
  };

  const addNote = async (noteData: ChoreCompletionNoteInput) => {
    try {
      await addChoreNote({
        variables: {
          note: noteData,
        },
      });
    } catch (err) {
      toast.error('Error adding note');
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
