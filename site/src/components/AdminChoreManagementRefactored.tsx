import React, { useState } from 'react';
import { Chore } from '../types/chore';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import ChoreCard from './ChoreCard';
import CreateChoreForm from './CreateChoreForm';
import CreateUserForm from './CreateUserForm';
import UserManagementCard from './UserManagementCard';
import { useAdminChoreManagement } from '../hooks/useAdminChoreManagement';

interface AdminChoreManagementProps {
  adminId: number;
}

export const AdminChoreManagement: React.FC<AdminChoreManagementProps> = ({ adminId }) => {
  const [isCreatingChore, setIsCreatingChore] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isManagingUsers, setIsManagingUsers] = useState(false);
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null);

  const {
    chores,
    users,
    loading,
    error,
    createNewChore,
    updateExistingChore,
    createNewUser,
    assignUser,
    unassignUser,
    refetchUsers,
  } = useAdminChoreManagement();

  const handleImageUpload = async (userUuid: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`/images/upload/${userUuid}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await refetchUsers();
      } else {
        console.error('Failed to upload image');
      }
    } catch (err) {
      console.error('Error uploading image:', err);
    }
  };

  const handleRemoveImage = async (userUuid: string) => {
    try {
      const response = await fetch(`/images/remove/${userUuid}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await refetchUsers();
      } else {
        console.error('Failed to remove image');
      }
    } catch (err) {
      console.error('Error removing image:', err);
    }
  };

  const handleAssignUser = async (choreId: number, userId: number) => {
    try {
      await assignUser(choreId, userId);
    } catch (err) {
      console.error('Error assigning chore to user:', err);
    }
  };

  const handleUnassignUser = async (choreId: number, userId: number) => {
    try {
      await unassignUser(choreId, userId);
    } catch (err) {
      console.error('Error unassigning chore to user:', err);
    }
  };

  const handleCreateChore = async (choreData: any, selectedUserIds: number[]) => {
    await createNewChore(choreData, selectedUserIds);
    setIsCreatingChore(false);
  };

  const handleUpdateChore = async (choreData: any, selectedUserIds: number[]) => {
    await updateExistingChore(choreData, selectedUserIds);
    setEditingChore(null);
  };

  const handleCreateUser = async (userData: any) => {
    await createNewUser(userData);
    setIsCreatingUser(false);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error loading data: {error.message}</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Mobile-responsive header */}
      <div className="space-y-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Chore Management</h2>

        {/* Mobile: Stack buttons vertically, Desktop: Horizontal layout */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={() => setIsManagingUsers(true)}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-sm sm:text-base font-medium"
          >
            <span className="block sm:hidden">👥 Manage Users</span>
            <span className="hidden sm:block">👥 Manage Users</span>
          </button>
          <button
            onClick={() => setIsCreatingUser(true)}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm sm:text-base font-medium"
          >
            <span className="block sm:hidden">+ New User</span>
            <span className="hidden sm:block">+ Create New User</span>
          </button>
          <button
            onClick={() => setIsCreatingChore(true)}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm sm:text-base font-medium"
          >
            <span className="block sm:hidden">+ New Chore</span>
            <span className="hidden sm:block">+ Create New Chore</span>
          </button>
        </div>
      </div>

      {/* Existing Chores */}
      <div className="grid gap-4">
        {chores.map((chore) => (
          <ChoreCard
            key={chore.id}
            chore={chore}
            onManage={setSelectedChore}
            onEdit={setEditingChore}
          />
        ))}
      </div>

      {/* Create Chore Modal */}
      <Modal
        isOpen={isCreatingChore}
        onClose={() => setIsCreatingChore(false)}
        title="Create New Chore"
        maxWidth="sm"
      >
        <CreateChoreForm
          users={users}
          adminId={adminId}
          onSubmit={handleCreateChore}
          onCancel={() => setIsCreatingChore(false)}
        />
      </Modal>

      {/* Edit Chore Modal */}
      <Modal
        isOpen={!!editingChore}
        onClose={() => setEditingChore(null)}
        title={`Edit: ${editingChore?.name}`}
        maxWidth="sm"
      >
        {editingChore && (
          <CreateChoreForm
            users={users}
            adminId={adminId}
            initialChore={editingChore}
            onSubmit={handleUpdateChore}
            onCancel={() => setEditingChore(null)}
          />
        )}
      </Modal>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreatingUser}
        onClose={() => setIsCreatingUser(false)}
        title="Create New User"
        maxWidth="sm"
      >
        <CreateUserForm onSubmit={handleCreateUser} onCancel={() => setIsCreatingUser(false)} />
      </Modal>

      {/* Chore Assignment Modal */}
      <Modal
        isOpen={!!selectedChore}
        onClose={() => setSelectedChore(null)}
        title={`Assign Users: ${selectedChore?.name}`}
        maxWidth="sm"
      >
        {selectedChore && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-300 mb-3">Assign to Users:</p>
              <div className="space-y-3">
                {users.map((user) => {
                  const isAssigned = selectedChore.assignedUsers?.some((au) => au.id === user.id);
                  return (
                    <div
                      key={user.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-700 rounded-lg"
                    >
                      <span className="text-sm text-gray-300 font-medium">{user.name}</span>
                      <button
                        onClick={() =>
                          !isAssigned
                            ? handleAssignUser(selectedChore.id, user.id)
                            : handleUnassignUser(selectedChore.id, user.id)
                        }
                        className={`w-full sm:w-auto px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                          isAssigned
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {isAssigned ? 'Unassign' : 'Assign'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* User Management Modal */}
      <Modal
        isOpen={isManagingUsers}
        onClose={() => setIsManagingUsers(false)}
        title="Manage Users"
        maxWidth="lg"
      >
        <div className="grid gap-4">
          {users.map((user) => (
            <UserManagementCard
              key={user.id}
              user={user}
              onImageUpload={handleImageUpload}
              onRemoveImage={handleRemoveImage}
            />
          ))}

          {users.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p>No users found. Create a new user to get started.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default AdminChoreManagement;
