import React, { useState } from 'react';
import { ChoreCompletion } from '../types/chore';
import { getWeekDateRange, formatDateForDisplay } from '../utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import ChoreCompletionDetail from './ChoreCompletionDetail';
import WeekNavigator from './WeekNavigator';
import CompletionCard from './CompletionCard';
import { useWeeklyCompletions } from '../hooks/useWeeklyCompletions';

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
    approveCompletion,
    deleteCompletion,
  } = useWeeklyCompletions({
    weekStartDate: weekRange.start,
  });

  const handleApproveCompletion = async (completion: ChoreCompletion) => {
    try {
      await approveCompletion(completion.uuid, adminId);
    } catch (err) {
      console.error('Error approving completion:', err);
    }
  };

  const handleRejectCompletion = async (completion: ChoreCompletion) => {
    if (!confirm('Are you sure you want to reject and delete this completion?')) {
      return;
    }

    try {
      await deleteCompletion(completion.uuid);
    } catch (err) {
      console.error('Error rejecting completion:', err);
    }
  };

  const handleCompletionUpdate = () => {
    setSelectedCompletion(null);
  };

  const handleWeekChange = (newWeekStart: Date) => {
    setCurrentWeekStart(newWeekStart);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error loading completions: {error.message}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Completion Review</h2>
        <WeekNavigator
          currentWeekStart={currentWeekStart}
          onWeekChange={handleWeekChange}
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
          <div className="space-y-3">
            {pendingCompletions.map((completion) => (
              <CompletionCard
                key={completion.id}
                completion={completion}
                onViewDetails={setSelectedCompletion}
                onApprove={handleApproveCompletion}
                onReject={handleRejectCompletion}
                showActions={true}
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
          <div className="space-y-3">
            {approvedCompletions.map((completion) => (
              <CompletionCard
                key={completion.id}
                completion={completion}
                onViewDetails={setSelectedCompletion}
                showActions={false}
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
            onUpdate={handleCompletionUpdate}
          />
        )}
      </Modal>
    </div>
  );
};

export default AdminCompletionReview;
