import { useQuery } from '@apollo/client';
import { Chore, User, ChoreInput, UserInput } from 'types/chore';
import {
  GET_ALL_CHORES,
  GET_ALL_USERS,
  CREATE_CHORE,
  UPDATE_CHORE,
  CREATE_USER,
  ASSIGN_CHORE_TO_USER,
  UNASSIGN_USER_FROM_CHORE,
} from 'graphql/queries';
import { withErrorToast } from 'utils/withErrorToast';
import { useRefetchingMutation } from './useRefetchingMutation';

export const useAdminChoreManagement = () => {
  const {
    data: choresData,
    loading: choresLoading,
    error: choresError,
    refetch: refetchChores,
  } = useQuery(GET_ALL_CHORES);

  const {
    data: usersData,
    loading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery(GET_ALL_USERS);

  const [createChore] = useRefetchingMutation(CREATE_CHORE, refetchChores);
  const [updateChore] = useRefetchingMutation(UPDATE_CHORE, refetchChores);
  const [createUser] = useRefetchingMutation(CREATE_USER, refetchUsers);
  const [assignChoreToUser] = useRefetchingMutation(ASSIGN_CHORE_TO_USER, refetchChores);
  const [unassignUserFromChore] = useRefetchingMutation(UNASSIGN_USER_FROM_CHORE, refetchChores);

  const chores: Chore[] = choresData?.listChores ?? [];
  const users: User[] = usersData?.listUsers ?? [];

  const createNewChore = (choreData: ChoreInput, selectedUserIds: number[] = []) =>
    withErrorToast('Error creating chore', async () => {
      const response = await createChore({ variables: { chore: choreData } });
      if (selectedUserIds.length > 0 && response.data?.createChore) {
        const choreId = response.data.createChore.id;
        await Promise.all(
          selectedUserIds.map((userId) => assignChoreToUser({ variables: { choreId, userId } })),
        );
      }
    });

  const updateExistingChore = (choreData: ChoreInput, selectedUserIds: number[] = []) => {
    // Capture current assignments synchronously before the mutation to avoid
    // reading stale state after the refetch triggered by onCompleted.
    const preUpdateChore = choreData.uuid ? chores.find((c) => c.uuid === choreData.uuid) : null;
    const previousUserIds = preUpdateChore?.assignedUsers?.map((u) => u.id) ?? [];

    return withErrorToast('Error updating chore', async () => {
      const response = await updateChore({ variables: { chore: choreData } });
      if (response.data?.updateChore) {
        const choreId = response.data.updateChore.id;

        // Diff against pre-mutation snapshot, not stale post-refetch state
        const usersToAssign = selectedUserIds.filter((id) => !previousUserIds.includes(id));
        const usersToUnassign = previousUserIds.filter((id) => !selectedUserIds.includes(id));

        await Promise.all([
          ...usersToAssign.map((userId) => assignChoreToUser({ variables: { choreId, userId } })),
          ...usersToUnassign.map((userId) =>
            unassignUserFromChore({ variables: { choreId, userId } }),
          ),
        ]);
      }
    });
  };

  const createNewUser = (userData: UserInput) =>
    withErrorToast('Error creating user', () => createUser({ variables: { user: userData } }));

  const assignUser = (choreId: number, userId: number) =>
    withErrorToast('Error assigning user to chore', () =>
      assignChoreToUser({ variables: { choreId, userId } }),
    );

  const unassignUser = (choreId: number, userId: number) =>
    withErrorToast('Error unassigning user from chore', () =>
      unassignUserFromChore({ variables: { choreId, userId } }),
    );

  return {
    chores,
    users,
    loading: choresLoading || usersLoading,
    error: choresError || usersError,
    createNewChore,
    updateExistingChore,
    createNewUser,
    assignUser,
    unassignUser,
    refetchChores,
    refetchUsers,
  };
};
