import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'react-toastify';
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

  const [createChore] = useMutation(CREATE_CHORE, {
    onCompleted: () => {
      refetchChores();
    },
  });

  const [updateChore] = useMutation(UPDATE_CHORE, {
    onCompleted: () => {
      refetchChores();
    },
  });

  const [createUser] = useMutation(CREATE_USER, {
    onCompleted: () => {
      refetchUsers();
    },
  });

  const [assignChoreToUser] = useMutation(ASSIGN_CHORE_TO_USER, {
    onCompleted: () => {
      refetchChores();
    },
  });

  const [unassignUserFromChore] = useMutation(UNASSIGN_USER_FROM_CHORE, {
    onCompleted: () => {
      refetchChores();
    },
  });

  const chores: Chore[] = choresData?.listChores ?? [];
  const users: User[] = usersData?.listUsers ?? [];

  const createNewChore = async (choreData: ChoreInput, selectedUserIds: number[] = []) => {
    try {
      const response = await createChore({
        variables: { chore: choreData },
      });

      if (selectedUserIds.length > 0 && response.data?.createChore) {
        const choreId = response.data.createChore.id;
        await Promise.all(
          selectedUserIds.map((userId) => assignChoreToUser({ variables: { choreId, userId } })),
        );
      }
    } catch (error) {
      toast.error('Error creating chore');
      throw error;
    }
  };

  const updateExistingChore = async (choreData: ChoreInput, selectedUserIds: number[] = []) => {
    // Capture current assignments synchronously before the mutation to avoid
    // reading stale state after the refetch triggered by onCompleted.
    const preUpdateChore = choreData.uuid ? chores.find((c) => c.uuid === choreData.uuid) : null;
    const previousUserIds = preUpdateChore?.assignedUsers?.map((u) => u.id) ?? [];

    try {
      const response = await updateChore({
        variables: { chore: choreData },
      });

      if (response.data?.updateChore) {
        const choreId = response.data.updateChore.id;

        // Diff against pre-mutation snapshot, not stale post-refetch state
        const currentUserIds = previousUserIds;

        // Find users to assign (in selectedUserIds but not in currentUserIds)
        const usersToAssign = selectedUserIds.filter((id) => !currentUserIds.includes(id));

        // Find users to unassign (in currentUserIds but not in selectedUserIds)
        const usersToUnassign = currentUserIds.filter((id) => !selectedUserIds.includes(id));

        await Promise.all([
          ...usersToAssign.map((userId) => assignChoreToUser({ variables: { choreId, userId } })),
          ...usersToUnassign.map((userId) =>
            unassignUserFromChore({ variables: { choreId, userId } }),
          ),
        ]);
      }
    } catch (error) {
      toast.error('Error updating chore');
      throw error;
    }
  };

  const createNewUser = async (userData: UserInput) => {
    try {
      await createUser({
        variables: { user: userData },
      });
    } catch (error) {
      toast.error('Error creating user');
      throw error;
    }
  };

  const assignUser = async (choreId: number, userId: number) => {
    try {
      await assignChoreToUser({
        variables: { choreId, userId },
      });
    } catch (error) {
      toast.error('Error assigning user to chore');
      throw error;
    }
  };

  const unassignUser = async (choreId: number, userId: number) => {
    try {
      await unassignUserFromChore({
        variables: { choreId, userId },
      });
    } catch (error) {
      toast.error('Error unassigning user from chore');
      throw error;
    }
  };

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
