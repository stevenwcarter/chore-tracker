import React from 'react';

interface AdminChoreToolbarProps {
  onManageUsers: () => void;
  onCreateUser: () => void;
  onCreateChore: () => void;
  onCreateBonusChore: () => void;
}

export const AdminChoreToolbar: React.FC<AdminChoreToolbarProps> = ({
  onManageUsers,
  onCreateUser,
  onCreateChore,
  onCreateBonusChore,
}) => {
  return (
    <div className="flex flex-col lg:flex-row gap-3">
      <button
        onClick={onManageUsers}
        className="w-full lg:w-auto px-4 py-3 lg:py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-sm lg:text-base font-medium"
      >
        👥 Manage Users
      </button>
      <button
        onClick={onCreateUser}
        className="w-full lg:w-auto px-4 py-3 lg:py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm lg:text-base font-medium"
      >
        + Create New User
      </button>
      <button
        onClick={onCreateChore}
        className="w-full lg:w-auto px-4 py-3 lg:py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm lg:text-base font-medium"
      >
        + Create New Chore
      </button>
      <button
        onClick={onCreateBonusChore}
        className="w-full lg:w-auto px-4 py-3 lg:py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors text-sm lg:text-base font-medium"
      >
        + Create Bonus Chore
      </button>
    </div>
  );
};

export default AdminChoreToolbar;
