import React from 'react';
import { User } from '../types/chore';
import UserImage from './UserImage';

interface UserManagementCardProps {
  user: User;
  onImageUpload: (userUuid: string, file: File) => void;
  onRemoveImage: (userUuid: string) => void;
}

export const UserManagementCard: React.FC<UserManagementCardProps> = ({
  user,
  onImageUpload,
  onRemoveImage,
}) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageUpload(user.uuid, file);
    }
  };

  console.log(user);

  return (
    <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
      {/* Mobile: Stack vertically, Desktop: Side by side */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <UserImage user={user} />
          <div>
            <h4 className="text-base sm:text-lg font-semibold text-white">{user.name}</h4>
            <p className="text-xs sm:text-sm text-gray-400">ID: {user.id}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer transition-colors text-sm font-medium">
            <span className="hidden sm:inline">📷 Upload Photo</span>
            <span className="sm:hidden">📷 Upload</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
          {user.imagePath && (
            <button
              onClick={() => onRemoveImage(user.uuid)}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm font-medium"
            >
              <span className="hidden sm:inline">🗑️ Remove Photo</span>
              <span className="sm:hidden">🗑️ Remove</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagementCard;
