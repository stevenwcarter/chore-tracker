import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_ALL_WEEKLY_COMPLETIONS,
  APPROVE_CHORE_COMPLETION,
  DELETE_CHORE_COMPLETION,
} from '../graphql/queries';
import { ChoreCompletion } from '../types/chore';
import {
  getWeekDateRange,
  formatDateForGraphQL,
  formatDateForDisplay,
  formatCurrency,
  getNextWeek,
  getPreviousWeek,
} from '../utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import ChoreCompletionDetail from './ChoreCompletionDetail';

interface AdminCompletionReviewProps {
  adminId: number;
}

export const AdminCompletionReview: React.FC<AdminCompletionReviewProps> = ({ adminId }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekDateRange().start);
  const [selectedCompletion, setSelectedCompletion] = useState<ChoreCompletion | null>(null);

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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 space-y-3">
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
                  <div className="flex md:flex-col gap-2">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 space-y-3">
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
      <Modal
        isOpen={!!selectedCompletion}
        onClose={() => setSelectedCompletion(null)}
        title="Completion Details"
        maxWidth="md"
      >
        {selectedCompletion && (
          <ChoreCompletionDetail
            completion={selectedCompletion}
            isAdmin={true}
            adminId={adminId}
            onClose={() => setSelectedCompletion(null)}
            onUpdate={() => {
              refetch();
              setSelectedCompletion(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default AdminCompletionReview;
