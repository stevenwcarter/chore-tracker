import React, { useState } from 'react';
import { getWeekDateRange, formatDateForDisplay } from '../utils/dateUtils';
import { ChoreCompletion } from '../types/chore';
import { useWeeklyCompletions } from '../hooks/useWeeklyCompletions';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import ChoreCompletionDetail from './ChoreCompletionDetail';
import CompletionCard from './CompletionCard';
import WeekNavigator from './WeekNavigator';

interface AdminCompletionReviewProps {
  adminId: number;
}

export const AdminCompletionReview: React.FC<AdminCompletionReviewProps> = ({ adminId }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekDateRange().start);
  const [selectedCompletion, setSelectedCompletion] = useState<ChoreCompletion | null>(null);

  const weekRange = getWeekDateRange(currentWeekStart);

  const {
    pendingCompletions,
    approvedCompletions,
    loading,
    error,
    refetch,
    approveCompletion,
    deleteCompletion,
  } = useWeeklyCompletions({
    weekStartDate: weekRange.start,
    onMutated: () => setSelectedCompletion(null),
  });

  // approveCompletion/deleteCompletion already toast on failure (withErrorToast)
  // and then re-throw; CompletionCard invokes these handlers from a bare
  // onClick without awaiting or catching the result, so an uncaught rejection
  // here surfaces as an unhandled promise rejection. Nothing downstream needs
  // the rejection to propagate further, so swallow it after the toast fires.
  const handleApproveCompletion = (completion: ChoreCompletion) =>
    approveCompletion(completion.uuid).catch(() => {});

  const handleRejectCompletion = async (completion: ChoreCompletion) => {
    if (!confirm('Are you sure you want to reject and delete this completion?')) {
      return;
    }
    await deleteCompletion(completion.uuid).catch(() => {});
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error loading completions: {error.message}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Completion Review</h2>
        <WeekNavigator
          currentWeekStart={currentWeekStart}
          onWeekChange={setCurrentWeekStart}
          weekRange={weekRange}
        />
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
              <CompletionCard
                key={completion.id}
                completion={completion}
                onViewDetails={setSelectedCompletion}
                onApprove={handleApproveCompletion}
                onReject={handleRejectCompletion}
                showActions
                actionsLayout="stacked"
              />
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
              <CompletionCard
                key={completion.id}
                completion={completion}
                onViewDetails={setSelectedCompletion}
              />
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
