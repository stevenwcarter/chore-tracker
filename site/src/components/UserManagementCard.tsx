import React from 'react';
import { User } from '../types/chore';

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
  const getUserImageUrl = (userObj: User): string | null => {
    if (userObj.id) {
      return `/images/user/${userObj.id}`;
    }
    return null;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageUpload(user.uuid, file);
    }
  };

  return (
    <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
      {/* Mobile: Stack vertically, Desktop: Side by side */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {getUserImageUrl(user) ? (
            <img
              src={getUserImageUrl(user)!}
              alt={user.name}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-600 flex items-center justify-center">
              <span className="text-lg sm:text-2xl text-gray-400">👤</span>
            </div>
          )}
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
