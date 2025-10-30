import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_UNPAID_TOTALS, MARK_COMPLETIONS_AS_PAID } from '../graphql/queries';
import { UnpaidTotal } from '../types/chore';
import { formatCurrency } from '../utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';

interface AdminPayoutSystemProps {
  adminId: number;
}

export const AdminPayoutSystem: React.FC<AdminPayoutSystemProps> = (
  _props: AdminPayoutSystemProps,
) => {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_UNPAID_TOTALS, {
    fetchPolicy: 'no-cache',
  });

  const [markCompletionsAsPaid] = useMutation(MARK_COMPLETIONS_AS_PAID, {
    onCompleted: () => {
      refetch();
      setSelectedUsers([]);
      setIsProcessingPayout(false);
    },
  });

  const handleUserToggle = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSelectAll = () => {
    const unpaidTotals: UnpaidTotal[] = data?.getUnpaidTotals || [];
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
      await markCompletionsAsPaid({
        variables: { userIds: selectedUsers },
      });
    } catch (e) {
      console.error('Error processing payout:', e);
      setIsProcessingPayout(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error loading payout data: {error.message}</div>;

  const unpaidTotals: UnpaidTotal[] = data?.getUnpaidTotals || [];
  const totalUnpaidAmount = unpaidTotals.reduce((sum, total) => sum + total.amountCents, 0);
  const selectedTotal = unpaidTotals
    .filter((total) => selectedUsers.includes(total.user.id))
    .reduce((sum, total) => sum + total.amountCents, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Payout System</h2>
          <p className="text-gray-300 mt-1">Manage payments for completed chores</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Outstanding</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalUnpaidAmount)}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-900 p-4 rounded-lg border-l-4 border-blue-500">
          <h3 className="font-semibold text-blue-100">Users with Unpaid Chores</h3>
          <p className="text-2xl font-bold text-blue-100">
            {unpaidTotals.filter((total) => total.amountCents > 0).length}
          </p>
        </div>

        <div className="bg-green-900 p-4 rounded-lg border-l-4 border-green-500">
          <h3 className="font-semibold text-green-100">Total Outstanding</h3>
          <p className="text-2xl font-bold text-green-100">{formatCurrency(totalUnpaidAmount)}</p>
        </div>

        <div className="bg-purple-900 p-4 rounded-lg border-l-4 border-purple-500">
          <h3 className="font-semibold text-purple-100">Selected for Payout</h3>
          <p className="text-2xl font-bold text-purple-100">{formatCurrency(selectedTotal)}</p>
        </div>
      </div>

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
            <div
              key={total.user.id}
              className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                selectedUsers.includes(total.user.id)
                  ? 'bg-blue-900 border-blue-600'
                  : 'bg-gray-900 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(total.user.id)}
                  onChange={() => handleUserToggle(total.user.id)}
                  disabled={total.amountCents === 0}
                  className="w-4 h-4 text-blue-200 rounded focus:ring-blue-300"
                />
                <div>
                  <h4 className="font-medium text-gray-200">{total.user.name}</h4>
                  <p className="text-sm text-gray-200">User ID: {total.user.id}</p>
                </div>
              </div>

              <div className="text-right">
                <p
                  className={`text-lg font-semibold ${
                    total.amountCents > 0 ? 'text-green-400' : 'text-gray-400'
                  }`}
                >
                  {formatCurrency(total.amountCents)}
                </p>
                {total.amountCents === 0 && (
                  <p className="text-xs text-gray-500">No unpaid chores</p>
                )}
              </div>
            </div>
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
        <div className="bg-gray-800 text-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Process Payout</h3>

          <div className="bg-yellow-900 border-l-4 border-yellow-500 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-200">
                  <strong>Warning:</strong> This action will mark selected chore completions as
                  paid. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400">
                Selected: {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}
              </p>
              <p className="text-lg font-semibold text-green-400">
                Total Amount: {formatCurrency(selectedTotal)}
              </p>
            </div>

            <button
              onClick={handleProcessPayout}
              disabled={isProcessingPayout || selectedUsers.length === 0}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {isProcessingPayout ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>💰 Process Payout</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Recent Payouts */}
      <div className="bg-gray-800 text-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <div className="text-center py-8 text-gray-400">
          <p>Payout history feature coming soon</p>
          <p className="text-sm">This will show recent payout transactions and dates</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPayoutSystem;
