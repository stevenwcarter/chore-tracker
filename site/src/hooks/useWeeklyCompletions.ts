import { useQuery } from '@apollo/client/react';
import { ChoreCompletion, ChoreCompletionNoteInput } from 'types/chore';
import {
  GET_ALL_WEEKLY_COMPLETIONS,
  APPROVE_CHORE_COMPLETION,
  ADD_CHORE_NOTE,
  DELETE_CHORE_COMPLETION,
} from 'graphql/queries';
import { formatDateForGraphQL } from 'utils/dateUtils';
import { withErrorToast } from 'utils/withErrorToast';
import { useRefetchingMutation } from './useRefetchingMutation';

interface UseWeeklyCompletionsOptions {
  weekStartDate: Date;
  /** Runs after a successful approve/delete/note — e.g. to close a detail modal. */
  onMutated?: () => void;
}

export const useWeeklyCompletions = ({ weekStartDate, onMutated }: UseWeeklyCompletionsOptions) => {
  const { data, loading, error, refetch } = useQuery<{
    getAllWeeklyCompletions: ChoreCompletion[];
  }>(GET_ALL_WEEKLY_COMPLETIONS, {
    fetchPolicy: 'cache-and-network',
    variables: {
      weekStartDate: formatDateForGraphQL(weekStartDate),
    },
    pollInterval: 30_000,
  });

  const [approveChoreCompletion] = useRefetchingMutation(APPROVE_CHORE_COMPLETION, refetch);
  const [addChoreNote] = useRefetchingMutation(ADD_CHORE_NOTE, refetch);
  const [deleteChoreCompletion] = useRefetchingMutation(DELETE_CHORE_COMPLETION, refetch);

  const completions: ChoreCompletion[] = data?.getAllWeeklyCompletions ?? [];

  const approveCompletion = (completionUuid: string) =>
    withErrorToast('Error approving completion', () =>
      approveChoreCompletion({ variables: { completionUuid } }),
    ).then((result) => {
      onMutated?.();
      return result;
    });

  const deleteCompletion = (completionUuid: string) =>
    withErrorToast('Error deleting completion', () =>
      deleteChoreCompletion({ variables: { completionUuid } }),
    ).then((result) => {
      onMutated?.();
      return result;
    });

  const addNote = (noteData: ChoreCompletionNoteInput) =>
    withErrorToast('Error adding note', () => addChoreNote({ variables: { note: noteData } }));

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
