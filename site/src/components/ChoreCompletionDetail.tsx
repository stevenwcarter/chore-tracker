import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { ChoreCompletion, AuthorType } from '../types/chore';
import { formatCurrency } from '../utils/dateUtils';
import {
  ADD_CHORE_NOTE,
  APPROVE_CHORE_COMPLETION,
  DELETE_CHORE_COMPLETION,
} from '../graphql/queries';

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
  const [noteText, setNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteVisibleToUser, setNoteVisibleToUser] = useState(true);

  const [addChoreNote] = useMutation(ADD_CHORE_NOTE, {
    onCompleted: () => {
      setNoteText('');
      setIsAddingNote(false);
      onUpdate?.();
    },
  });

  const [approveChoreCompletion] = useMutation(APPROVE_CHORE_COMPLETION, {
    onCompleted: () => {
      onUpdate?.();
      onClose();
    },
  });

  const [deleteChoreCompletion] = useMutation(DELETE_CHORE_COMPLETION, {
    onCompleted: () => {
      onUpdate?.();
      onClose();
    },
  });

  const handleAddNote = async () => {
    if (!noteText.trim()) return;

    try {
      await addChoreNote({
        variables: {
          note: {
            choreCompletionId: completion.id,
            noteText: noteText.trim(),
            authorType: isAdmin ? AuthorType.Admin : AuthorType.User,
            ...(isAdmin ? { authorAdminId: adminId } : { authorUserId: userId }),
            visibleToUser: noteVisibleToUser,
          },
        },
      });
    } catch (err) {
      console.error('Error adding note:', err);
    }
  };

  const handleApproveCompletion = async () => {
    if (!isAdmin || !adminId) return;

    try {
      await approveChoreCompletion({
        variables: {
          completionUuid: completion.uuid,
          adminId: adminId,
        },
      });
    } catch (err) {
      console.error('Error approving completion:', err);
    }
  };

  const handleRejectCompletion = async () => {
    if (!isAdmin) return;

    if (!confirm('Are you sure you want to reject and delete this completion?')) {
      return;
    }

    try {
      await deleteChoreCompletion({
        variables: {
          completionUuid: completion.uuid,
        },
      });
    } catch (err) {
      console.error('Error rejecting completion:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-400">Status:</p>
        <p className={`font-medium ${completion.approved ? 'text-green-400' : 'text-yellow-400'}`}>
          {completion.approved ? 'Approved' : 'Pending Approval'}
        </p>
      </div>

      {completion.chore && (
        <div>
          <p className="text-sm text-gray-400">Chore:</p>
          <p className="font-medium text-white">
            {completion.chore.name || completion.chore.title}
          </p>
        </div>
      )}

      {completion.user && (
        <div>
          <p className="text-sm text-gray-400">User:</p>
          <p className="font-medium text-white">{completion.user.name}</p>
        </div>
      )}

      <div>
        <p className="text-sm text-gray-400">Completed Date:</p>
        <p className="font-medium text-white">
          {completion.completedDate || completion.completedAt || completion.createdAt}
        </p>
      </div>

      <div>
        <p className="text-sm text-gray-400">Amount:</p>
        <p className="font-medium text-green-400">{formatCurrency(completion.amountCents)}</p>
      </div>

      {/* Admin approval controls */}
      {isAdmin && !completion.approved && (
        <div>
          <p className="text-sm text-gray-400 mb-2">Admin Actions:</p>
          <div className="flex gap-2">
            <button
              onClick={handleApproveCompletion}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
            >
              ✓ Approve
            </button>
            <button
              onClick={handleRejectCompletion}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
            >
              ✗ Reject
            </button>
          </div>
        </div>
      )}

      {/* Notes display */}
      {completion.notes && completion.notes.length > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-2">Notes:</p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {completion.notes
              .filter((note) => isAdmin || note.visibleToUser)
              .map((note) => (
                <div key={note.id} className="bg-gray-700 p-2 rounded text-sm">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-white">{note.note}</p>
                    {isAdmin && !note.visibleToUser && (
                      <span className="text-xs bg-red-600 text-white px-1 rounded">Admin Only</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {note.authorType === AuthorType.Admin ? 'Admin' : 'User'} •{' '}
                    {new Date(note.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Add note section */}
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
                onClick={handleAddNote}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsAddingNote(false);
                  setNoteText('');
                  setNoteVisibleToUser(true);
                }}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChoreCompletionDetail;
