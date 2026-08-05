import React from 'react';
import { User } from '../types/chore';
import Modal from './Modal';
import UserManagementCard from './UserManagementCard';

interface UserManagementModalProps {
  users: User[];
  isOpen: boolean;
  onClose: () => void;
  onImageUpload: (userUuid: string, file: File) => void;
  onRemoveImage: (userId: number) => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  users,
  isOpen,
  onClose,
  onImageUpload,
  onRemoveImage,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Users" maxWidth="lg">
      <div className="grid gap-4">
        {users.map((user) => (
          <UserManagementCard
            key={user.id}
            user={user}
            onImageUpload={onImageUpload}
            onRemoveImage={onRemoveImage}
          />
        ))}

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p>No users found. Create a new user to get started.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UserManagementModal;
