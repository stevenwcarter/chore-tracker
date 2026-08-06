import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Chore, ChoreInput, UserInput } from '../types/chore';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import ChoreCard from './ChoreCard';
import ChoreAssigneeFilter, { AssigneeFilterValue } from './ChoreAssigneeFilter';
import CreateChoreForm from './CreateChoreForm';
import CreateBonusChoreForm from './CreateBonusChoreForm';
import CreateUserForm from './CreateUserForm';
import AdminChoreToolbar from './AdminChoreToolbar';
import ChoreAssignmentModal from './ChoreAssignmentModal';
import UserManagementModal from './UserManagementModal';
import { useAdminChoreManagement } from '../hooks/useAdminChoreManagement';
import { useUserImages } from '../hooks/useUserImages';

interface AdminChoreManagementProps {
  adminId: number;
}

export const AdminChoreManagement: React.FC<AdminChoreManagementProps> = ({ adminId }) => {
  const [isCreatingChore, setIsCreatingChore] = useState(false);
  const [isCreatingBonusChore, setIsCreatingBonusChore] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isManagingUsers, setIsManagingUsers] = useState(false);
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilterValue>('all');

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

  const { uploadImage, removeImage } = useUserImages(refetchUsers);

  // Filtering is client-side: the chore list and its assignments are already loaded
  // for the assignment modal, so there is nothing to refetch.
  const visibleChores = useMemo(() => {
    if (assigneeFilter === 'all') return chores;
    if (assigneeFilter === 'unassigned') {
      return chores.filter((chore) => (chore.assignedUsers?.length ?? 0) === 0);
    }
    return chores.filter((chore) =>
      chore.assignedUsers?.some((user) => user.id === assigneeFilter),
    );
  }, [chores, assigneeFilter]);

  const emptyStateMessage =
    assigneeFilter === 'unassigned'
      ? 'No unassigned chores.'
      : `No chores assigned to ${users.find((u) => u.id === assigneeFilter)?.name ?? 'this user'}.`;

  const handleImageUpload = async (userUuid: string, file: File) => {
    try {
      await uploadImage(userUuid, file);
    } catch (err) {
      // uploadImage already toasted; swallow so this fire-and-forget caller
      // (UserManagementCard's onChange) doesn't leave an unhandled rejection.
    }
  };

  const handleRemoveImage = async (userId: number) => {
    try {
      await removeImage(userId);
    } catch (err) {
      // removeImage already toasted; swallow so this fire-and-forget caller
      // (UserManagementCard's onClick) doesn't leave an unhandled rejection.
    }
  };

  const handleAssignUser = async (choreId: number, userId: number) => {
    try {
      await assignUser(choreId, userId);
    } catch (err) {
      toast.error('Error assigning chore to user');
    }
  };

  const handleUnassignUser = async (choreId: number, userId: number) => {
    try {
      await unassignUser(choreId, userId);
    } catch (err) {
      toast.error('Error unassigning chore from user');
    }
  };

  const handleCreateChore = async (choreData: ChoreInput, selectedUserIds: number[]) => {
    await createNewChore(choreData, selectedUserIds);
    setIsCreatingChore(false);
  };

  const handleUpdateChore = async (choreData: ChoreInput, selectedUserIds: number[]) => {
    await updateExistingChore(choreData, selectedUserIds);
    setEditingChore(null);
  };

  const handleCreateUser = async (userData: UserInput) => {
    await createNewUser(userData);
    setIsCreatingUser(false);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error loading data: {error.message}</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Mobile-responsive header */}
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Chore Management</h2>

        {/* Always stack on small screens, horizontal on larger screens */}
        <AdminChoreToolbar
          onManageUsers={() => setIsManagingUsers(true)}
          onCreateUser={() => setIsCreatingUser(true)}
          onCreateChore={() => setIsCreatingChore(true)}
          onCreateBonusChore={() => setIsCreatingBonusChore(true)}
        />

        <ChoreAssigneeFilter users={users} value={assigneeFilter} onChange={setAssigneeFilter} />
      </div>

      {/* Existing Chores */}
      {visibleChores.length === 0 && assigneeFilter !== 'all' ? (
        <p className="text-gray-400">{emptyStateMessage}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {visibleChores.map((chore) => (
            <ChoreCard
              key={chore.id}
              chore={chore}
              onManage={setSelectedChore}
              onEdit={setEditingChore}
            />
          ))}
        </div>
      )}

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

      {/* Create Bonus Chore Modal */}
      <Modal
        isOpen={isCreatingBonusChore}
        onClose={() => setIsCreatingBonusChore(false)}
        title="Create Bonus Chore"
        maxWidth="sm"
      >
        <CreateBonusChoreForm
          currentAdminId={adminId}
          onSuccess={() => setIsCreatingBonusChore(false)}
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
      <ChoreAssignmentModal
        chore={selectedChore}
        users={users}
        onAssign={handleAssignUser}
        onUnassign={handleUnassignUser}
        onClose={() => setSelectedChore(null)}
      />

      {/* User Management Modal */}
      <UserManagementModal
        users={users}
        isOpen={isManagingUsers}
        onClose={() => setIsManagingUsers(false)}
        onImageUpload={handleImageUpload}
        onRemoveImage={handleRemoveImage}
      />
    </div>
  );
};

export default AdminChoreManagement;
