import React, { useState } from 'react';

interface AddNoteFormProps {
  isAdmin?: boolean;
  onSave: (noteText: string, visibleToUser: boolean) => Promise<boolean>;
  onCancel?: () => void;
}

export const AddNoteForm: React.FC<AddNoteFormProps> = ({ isAdmin = false, onSave, onCancel }) => {
  const [noteText, setNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteVisibleToUser, setNoteVisibleToUser] = useState(true);

  const handleSave = async () => {
    const saved = await onSave(noteText, noteVisibleToUser);
    if (saved) {
      setNoteText('');
      setIsAddingNote(false);
    }
  };

  const handleCancel = () => {
    setIsAddingNote(false);
    setNoteText('');
    setNoteVisibleToUser(true);
    onCancel?.();
  };

  return (
    <div>
      <button
        onClick={() => setIsAddingNote(!isAddingNote)}
        className="text-blue-400 hover:text-blue-300 text-sm"
      >
        + Add Note
      </button>

      {isAddingNote && (
        <div className="mt-2 space-y-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white text-sm"
            rows={3}
          />
          {isAdmin && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="noteVisibility"
                checked={noteVisibleToUser}
                onChange={(e) => setNoteVisibleToUser(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="noteVisibility" className="text-sm text-gray-300">
                Visible to user
              </label>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddNoteForm;
