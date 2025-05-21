import React, { useState } from 'react';
import { User } from '../types/chore';

interface CreateChoreFormProps {
  users: User[];
  adminId: number;
  onSubmit: (choreData: any, selectedUserIds: number[]) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const CreateChoreForm: React.FC<CreateChoreFormProps> = ({
  users,
  adminId: _adminId, // Admin ID for creating the chore
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState<number>(0);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      const choreData = {
        title: title.trim(),
        description: description.trim(),
        value,
      };
      await onSubmit(choreData, selectedUserIds);
      // Reset form
      setTitle('');
      setDescription('');
      setValue(0);
      setSelectedUserIds([]);
    }
  };

  const handleUserToggle = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="choreTitle" className="block text-sm font-medium text-gray-700 mb-1">
          Chore Title *
        </label>
        <input
          id="choreTitle"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter chore title"
          required
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="choreDescription" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="choreDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter chore description (optional)"
          rows={3}
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="choreValue" className="block text-sm font-medium text-gray-700 mb-1">
          Value ($)
        </label>
        <input
          id="choreValue"
          type="number"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0.00"
          min="0"
          step="0.01"
          disabled={loading}
        />
      </div>

      <div>
        <div className="block text-sm font-medium text-gray-700 mb-2">Assign to Users</div>
        <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-3">
          {users.map((user) => (
            <label key={user.id} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedUserIds.includes(user.id)}
                onChange={() => handleUserToggle(user.id)}
                className="rounded text-blue-600 focus:ring-blue-500"
                disabled={loading}
              />
              <span className="text-sm text-gray-700">{user.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || !title.trim()}
        >
          {loading ? 'Creating...' : 'Create Chore'}
        </button>
      </div>
    </form>
  );
};

export default CreateChoreForm;
