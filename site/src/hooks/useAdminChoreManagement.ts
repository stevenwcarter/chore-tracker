import { useMutation, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
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
  const [chores, setChores] = useState<Chore[]>([]);
  const [users, setUsers] = useState<User[]>([]);

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

  useEffect(() => {
    if (choresData?.listChores) {
      setChores(choresData.listChores);
    }
  }, [choresData]);

  useEffect(() => {
    if (usersData?.listUsers) {
      setUsers(usersData.listUsers);
    }
  }, [usersData]);

  const createNewChore = async (choreData: ChoreInput, selectedUserIds: number[] = []) => {
    try {
      const response = await createChore({
        variables: { chore: choreData },
      });

      if (selectedUserIds.length > 0 && response.data?.createChore) {
        for (const userId of selectedUserIds) {
          await assignChoreToUser({
            variables: { choreId: response.data.createChore.id, userId },
          });
        }
      }
    } catch (error) {
      console.error('Error creating chore:', error);
      throw error;
    }
  };

  const updateExistingChore = async (choreData: ChoreInput, selectedUserIds: number[] = []) => {
    try {
      const response = await updateChore({
        variables: { chore: choreData },
      });

      if (response.data?.updateChore) {
        const choreId = response.data.updateChore.id;

        // Get current assignments
        const currentChore = chores.find((c) => c.id === choreId);
        const currentUserIds = currentChore?.assignedUsers?.map((u) => u.id) || [];

        // Find users to assign (in selectedUserIds but not in currentUserIds)
        const usersToAssign = selectedUserIds.filter((id) => !currentUserIds.includes(id));

        // Find users to unassign (in currentUserIds but not in selectedUserIds)
        const usersToUnassign = currentUserIds.filter((id) => !selectedUserIds.includes(id));

        // Assign new users
        for (const userId of usersToAssign) {
          await assignChoreToUser({
            variables: { choreId, userId },
          });
        }

        // Unassign removed users
        for (const userId of usersToUnassign) {
          await unassignUserFromChore({
            variables: { choreId, userId },
          });
        }
      }
    } catch (error) {
      console.error('Error updating chore:', error);
      throw error;
    }
  };

  const createNewUser = async (userData: UserInput) => {
    try {
      await createUser({
        variables: { user: userData },
      });
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  };

  const assignUser = async (choreId: number, userId: number) => {
    try {
      await assignChoreToUser({
        variables: { choreId, userId },
      });
    } catch (error) {
      console.error('Error assigning user to chore:', error);
      throw error;
    }
  };

  const unassignUser = async (choreId: number, userId: number) => {
    try {
      await unassignUserFromChore({
        variables: { choreId, userId },
      });
    } catch (error) {
      console.error('Error unassigning user from chore:', error);
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
