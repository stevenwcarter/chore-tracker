import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_ALL_WEEKLY_COMPLETIONS,
  APPROVE_CHORE_COMPLETION,
  ADD_CHORE_NOTE,
  DELETE_CHORE_COMPLETION,
} from '../graphql/queries';
import { ChoreCompletion, AuthorType } from '../types/chore';
import {
  getWeekDateRange,
  formatDateForGraphQL,
  formatDateForDisplay,
  formatCurrency,
  getNextWeek,
  getPreviousWeek,
} from '../utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';

interface AdminCompletionReviewProps {
  adminId: number;
}

export const AdminCompletionReview: React.FC<AdminCompletionReviewProps> = ({ adminId }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekDateRange().start);
  const [selectedCompletion, setSelectedCompletion] = useState<ChoreCompletion | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteVisibleToUser, setNoteVisibleToUser] = useState(true);

  const weekRange = getWeekDateRange(currentWeekStart);

  const { data, loading, error, refetch } = useQuery(GET_ALL_WEEKLY_COMPLETIONS, {
    variables: {
      weekStartDate: formatDateForGraphQL(weekRange.start),
    },
  });

  const [approveChoreCompletion] = useMutation(APPROVE_CHORE_COMPLETION, {
    onCompleted: () => {
      refetch();
      setSelectedCompletion(null);
    },
  });

  const [addChoreNote] = useMutation(ADD_CHORE_NOTE, {
    onCompleted: () => {
      refetch();
      setNoteText('');
      setIsAddingNote(false);
      setSelectedCompletion(null);
    },
  });

  const [deleteChoreCompletion] = useMutation(DELETE_CHORE_COMPLETION, {
    onCompleted: () => {
      refetch();
      setSelectedCompletion(null);
    },
  });

  const handleApproveCompletion = async (completion: ChoreCompletion) => {
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

  const handleRejectCompletion = async (completion: ChoreCompletion) => {
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

  const handleAddNote = async () => {
    if (!selectedCompletion || !noteText.trim()) return;

    try {
      await addChoreNote({
        variables: {
          note: {
            choreCompletionId: selectedCompletion.id,
            noteText: noteText.trim(),
            authorType: AuthorType.Admin,
            authorAdminId: adminId,
            visibleToUser: noteVisibleToUser,
          },
        },
      });
    } catch (err) {
      console.error('Error adding note:', err);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error loading completions: {error.message}</div>;

  const completions: ChoreCompletion[] = data?.getAllWeeklyCompletions || [];
  const pendingCompletions = completions.filter((c) => !c.approved);
  const approvedCompletions = completions.filter((c) => c.approved);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Completion Review</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentWeekStart(getPreviousWeek(currentWeekStart))}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          >
            ← Previous
          </button>
          <button
            onClick={() => setCurrentWeekStart(getWeekDateRange().start)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            This Week
          </button>
          <button
            onClick={() => setCurrentWeekStart(getNextWeek(currentWeekStart))}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="text-gray-300 mb-4">
        Week of {formatDateForDisplay(weekRange.start)} - {formatDateForDisplay(weekRange.end)}
      </div>

      {/* Pending Completions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4">
          Pending Approval ({pendingCompletions.length})
        </h3>
        {pendingCompletions.length === 0 ? (
          <p className="text-gray-400">No pending completions for this week.</p>
        ) : (
          <div className="space-y-3">
            {pendingCompletions.map((completion) => (
              <div
                key={completion.id}
                className="bg-gray-700 p-4 rounded-lg border border-yellow-500"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">
                      {completion.chore?.name || 'Unknown Chore'}
                    </h4>
                    <p className="text-sm text-gray-300">
                      {completion.user?.name || 'Unknown User'} •{' '}
                      {completion.completedDate || completion.createdAt}
                    </p>
                    <p className="text-sm text-green-400 font-medium">
                      {formatCurrency(completion.amountCents)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedCompletion(completion)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleApproveCompletion(completion)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleRejectCompletion(completion)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved Completions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4">
          Approved This Week ({approvedCompletions.length})
        </h3>
        {approvedCompletions.length === 0 ? (
          <p className="text-gray-400">No approved completions for this week.</p>
        ) : (
          <div className="space-y-3">
            {approvedCompletions.map((completion) => (
              <div
                key={completion.id}
                className="bg-gray-700 p-4 rounded-lg border border-green-500"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">
                      {completion.chore?.name || 'Unknown Chore'}
                    </h4>
                    <p className="text-sm text-gray-300">
                      {completion.user?.name || 'Unknown User'} •{' '}
                      {completion.completedDate || completion.createdAt}
                    </p>
                    <p className="text-sm text-green-400 font-medium">
                      {formatCurrency(completion.amountCents)}
                    </p>
                    {completion.approvedAt && (
                      <p className="text-xs text-gray-400">
                        Approved: {new Date(completion.approvedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCompletion(completion)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completion Detail Modal */}
      {selectedCompletion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 text-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-white">Completion Details</h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Chore:</p>
                <p className="font-medium text-white">
                  {selectedCompletion.chore?.name || 'Unknown Chore'}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">User:</p>
                <p className="font-medium text-white">
                  {selectedCompletion.user?.name || 'Unknown User'}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Completed Date:</p>
                <p className="font-medium text-white">
                  {selectedCompletion.completedDate || selectedCompletion.createdAt}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Status:</p>
                <p
                  className={`font-medium ${
                    selectedCompletion.approved ? 'text-green-400' : 'text-yellow-400'
                  }`}
                >
                  {selectedCompletion.approved ? 'Approved' : 'Pending Approval'}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Amount:</p>
                <p className="font-medium text-green-400">
                  {formatCurrency(selectedCompletion.amountCents)}
                </p>
              </div>

              {/* Approval controls for pending completions */}
              {!selectedCompletion.approved && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Admin Actions:</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveCompletion(selectedCompletion)}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                    >
                      ✓ Approve
                    </button>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedCompletion.notes && selectedCompletion.notes.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Notes:</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedCompletion.notes.map((note) => (
                      <div key={note.id} className="bg-gray-700 p-2 rounded text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-white">{note.note}</p>
                          {!note.visibleToUser && (
                            <span className="text-xs bg-red-600 text-white px-1 rounded">
                              Admin Only
                            </span>
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

              {/* Add Note */}
              <div>
                <button
                  onClick={() => setIsAddingNote(!isAddingNote)}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  + Add Admin Note
                </button>

                {isAddingNote && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add an admin note..."
                      className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white text-sm"
                      rows={3}
                    />
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

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedCompletion(null)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCompletionReview;
