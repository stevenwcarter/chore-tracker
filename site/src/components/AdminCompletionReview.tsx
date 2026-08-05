import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { toast } from 'react-toastify';
import {
  GET_ALL_WEEKLY_COMPLETIONS,
  APPROVE_CHORE_COMPLETION,
  DELETE_CHORE_COMPLETION,
} from '../graphql/queries';
import { ChoreCompletion } from '../types/chore';
import { getWeekDateRange, formatDateForGraphQL, formatDateForDisplay } from '../utils/dateUtils';
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

  const { data, loading, error, refetch } = useQuery<{
    getAllWeeklyCompletions: ChoreCompletion[];
  }>(GET_ALL_WEEKLY_COMPLETIONS, {
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
        },
      });
    } catch (err) {
      toast.error('Error approving completion');
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
      toast.error('Error rejecting completion');
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
