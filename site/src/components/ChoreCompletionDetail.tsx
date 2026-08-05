import React from 'react';
import { ChoreCompletion } from '../types/chore';
import { useCompletionActions } from '../hooks/useCompletionActions';
import CompletionSummary from './CompletionSummary';
import CompletionNotesList from './CompletionNotesList';
import AddNoteForm from './AddNoteForm';

interface ChoreCompletionDetailProps {
  completion: ChoreCompletion;
  isAdmin?: boolean;
  adminId?: number;
  userId?: number;
  onClose: () => void;
  onUpdate?: () => void;
}

export const ChoreCompletionDetail: React.FC<ChoreCompletionDetailProps> = ({
  completion,
  isAdmin = false,
  adminId,
  userId,
  onClose,
  onUpdate,
}) => {
  const { addNote, approve, reject } = useCompletionActions({
    completion,
    isAdmin,
    adminId,
    userId,
    onUpdate,
    onClose,
  });

  return (
    <div className="space-y-4">
      <CompletionSummary completion={completion} />

      {/* Admin approval controls */}
      {isAdmin && !completion.approved && (
        <div>
          <p className="text-sm text-gray-400 mb-2">Admin Actions:</p>
          <div className="flex gap-2">
            <button
              onClick={approve}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
            >
              ✓ Approve
            </button>
            <button
              onClick={reject}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
            >
              ✗ Reject
            </button>
          </div>
        </div>
      )}

      <CompletionNotesList notes={completion.notes} isAdmin={isAdmin} />

      <AddNoteForm isAdmin={isAdmin} onSave={addNote} />
    </div>
  );
};

export default ChoreCompletionDetail;
