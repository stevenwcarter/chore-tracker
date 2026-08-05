import { useMutation } from '@apollo/client/react';
import { toast } from 'react-toastify';
import { ChoreCompletion, AuthorType } from 'types/chore';
import { ADD_CHORE_NOTE, APPROVE_CHORE_COMPLETION, DELETE_CHORE_COMPLETION } from 'graphql/queries';

interface UseCompletionActionsArgs {
  completion: ChoreCompletion;
  isAdmin?: boolean;
  adminId?: number;
  userId?: number;
  onUpdate?: () => void;
  onClose: () => void;
}

/**
 * Owns the three mutations behind a chore completion's detail view (add note,
 * approve, reject/delete) and their handlers.
 *
 * `addNote` resolves `true` on success and `false` on either a validation
 * no-op (blank text) or a mutation failure (already toasted here) -- callers
 * that hold their own draft-form state (e.g. `AddNoteForm`) use that to decide
 * whether to clear/collapse the form, matching the original component's
 * behaviour of only resetting on success.
 */
export const useCompletionActions = ({
  completion,
  isAdmin = false,
  adminId,
  userId,
  onUpdate,
  onClose,
}: UseCompletionActionsArgs) => {
  const [addChoreNote] = useMutation(ADD_CHORE_NOTE, {
    onCompleted: () => {
      onUpdate?.();
    },
  });

  const [approveChoreCompletion] = useMutation(APPROVE_CHORE_COMPLETION, {
    onCompleted: () => {
      onUpdate?.();
      onClose();
    },
  });

  const [deleteChoreCompletion] = useMutation(DELETE_CHORE_COMPLETION, {
    onCompleted: () => {
      onUpdate?.();
      onClose();
    },
  });

  const addNote = async (noteText: string, visibleToUser: boolean): Promise<boolean> => {
    if (!noteText.trim()) return false;

    try {
      await addChoreNote({
        variables: {
          note: {
            choreCompletionId: completion.id,
            noteText: noteText.trim(),
            authorType: isAdmin ? AuthorType.Admin : AuthorType.User,
            ...(isAdmin ? { authorAdminId: adminId } : { authorUserId: userId }),
            visibleToUser,
          },
        },
      });
      return true;
    } catch (err) {
      toast.error('Error adding note');
      return false;
    }
  };

  const approve = async () => {
    if (!isAdmin) return;

    try {
      await approveChoreCompletion({
        variables: {
          completionUuid: completion.uuid,
        },
      });
    } catch (err) {
      toast.error('Error approving completion');
    }
  };

  const reject = async () => {
    if (!isAdmin) return;

    if (!confirm('Are you sure you want to reject and delete this completion?')) {
      return;
    }

    try {
      await deleteChoreCompletion({
        variables: {
          completionUuid: completion.uuid,
        },
      });
    } catch (err) {
      toast.error('Error rejecting completion');
    }
  };

  return { addNote, approve, reject };
};
