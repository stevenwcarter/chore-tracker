import React, { useState } from 'react';
import { UserInput } from '../types/chore';

interface CreateUserFormProps {
  onSubmit: (userData: UserInput) => Promise<void>;
  onCancel: () => void;
}

export const CreateUserForm: React.FC<CreateUserFormProps> = ({ onSubmit, onCancel }) => {
  const [userForm, setUserForm] = useState<UserInput>({
    name: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(userForm);
      setUserForm({ name: '' });
    } catch (error) {
      console.error('Error creating user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="user-name" className="block text-sm font-medium text-gray-300 mb-1">
          Name *
        </label>
        <input
          id="user-name"
          type="text"
          value={userForm.name}
          onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={!userForm.name.trim() || isSubmitting}
          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded transition-colors"
        >
          {isSubmitting ? 'Creating...' : 'Create User'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default CreateUserForm;
