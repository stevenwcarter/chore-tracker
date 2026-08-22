import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_UNPAID_TOTALS, MARK_COMPLETIONS_AS_PAID } from '../graphql/queries';
import { UnpaidTotal } from '../types/chore';
import { formatCents } from '../utils/currency';
import { withErrorToast } from '../utils/withErrorToast';
import LoadingSpinner from './LoadingSpinner';
import PayoutSummaryCards from './PayoutSummaryCards';
import PayoutUserRow from './PayoutUserRow';
import PayoutActionsPanel from './PayoutActionsPanel';

interface AdminPayoutSystemProps {
  adminId: number;
}

export const AdminPayoutSystem: React.FC<AdminPayoutSystemProps> = () => {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  const { data, loading, error, refetch } = useQuery<{ getUnpaidTotals: UnpaidTotal[] }>(
    GET_UNPAID_TOTALS,
    {
      fetchPolicy: 'no-cache',
    },
  );

  const [markCompletionsAsPaid] = useMutation(MARK_COMPLETIONS_AS_PAID, {
    onCompleted: () => {
      refetch();
      setSelectedUsers([]);
      setIsProcessingPayout(false);
    },
  });

  const unpaidTotals: UnpaidTotal[] = useMemo(() => data?.getUnpaidTotals || [], [data]);

  const totalUnpaidAmount = useMemo(
    () => unpaidTotals.reduce((sum, total) => sum + total.amountCents, 0),
    [unpaidTotals],
  );

  const selectedTotal = useMemo(
    () =>
      unpaidTotals
        .filter((total) => selectedUsers.includes(total.user.id))
        .reduce((sum, total) => sum + total.amountCents, 0),
    [unpaidTotals, selectedUsers],
  );

  const handleUserToggle = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSelectAll = () => {
    const allUserIds = unpaidTotals
      .filter((total) => total.amountCents > 0)
      .map((total) => total.user.id);
    setSelectedUsers(allUserIds);
  };

  const handleClearSelection = () => {
    setSelectedUsers([]);
  };

  const handleProcessPayout = async () => {
    if (selectedUsers.length === 0) return;

    setIsProcessingPayout(true);
    try {
      await withErrorToast('Error processing payout', () =>
        markCompletionsAsPaid({ variables: { userIds: selectedUsers } }),
      );
    } catch (e) {
      setIsProcessingPayout(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error loading payout data: {error.message}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Payout System</h2>
          <p className="text-gray-300 mt-1">Manage payments for completed chores</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Outstanding</p>
          <p className="text-2xl font-bold text-green-600">{formatCents(totalUnpaidAmount)}</p>
        </div>
      </div>

      <PayoutSummaryCards
        userCount={unpaidTotals.filter((total) => total.amountCents > 0).length}
        totalUnpaidAmount={totalUnpaidAmount}
        selectedTotal={selectedTotal}
      />

      {/* User Selection and Actions */}
      <div className="bg-gray-800 text-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Select Users for Payout</h3>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
            >
              Select All
            </button>
            <button
              onClick={handleClearSelection}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 space-y-3">
          {unpaidTotals.map((total) => (
            <PayoutUserRow
              key={total.user.id}
              total={total}
              selected={selectedUsers.includes(total.user.id)}
              onToggle={handleUserToggle}
            />
          ))}
        </div>

        {unpaidTotals.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No users have unpaid chore completions</p>
          </div>
        )}
      </div>

      {/* Payout Actions */}
      {selectedUsers.length > 0 && (
        <PayoutActionsPanel
          selectedCount={selectedUsers.length}
          selectedTotal={selectedTotal}
          isProcessing={isProcessingPayout}
          onProcess={handleProcessPayout}
        />
      )}
    </div>
  );
};

export default AdminPayoutSystem;
