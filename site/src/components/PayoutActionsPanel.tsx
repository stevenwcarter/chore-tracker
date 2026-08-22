import React from 'react';
import { formatCents } from '../utils/currency';

interface PayoutActionsPanelProps {
  selectedCount: number;
  selectedTotal: number;
  isProcessing: boolean;
  onProcess: () => void;
}

export const PayoutActionsPanel: React.FC<PayoutActionsPanelProps> = ({
  selectedCount,
  selectedTotal,
  isProcessing,
  onProcess,
}) => (
  <div className="bg-gray-800 text-white rounded-lg shadow-md p-6">
    <h3 className="text-lg font-semibold text-white mb-4">Process Payout</h3>

    <div className="bg-yellow-900 border-l-4 border-yellow-500 p-4 mb-4">
      <div className="flex">
        <div className="ml-3">
          <p className="text-sm text-yellow-200">
            <strong>Warning:</strong> This action will mark selected chore completions as paid. This
            action cannot be undone.
          </p>
        </div>
      </div>
    </div>

    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-400">
          Selected: {selectedCount} user{selectedCount !== 1 ? 's' : ''}
        </p>
        <p className="text-lg font-semibold text-green-400">
          Total Amount: {formatCents(selectedTotal)}
        </p>
      </div>

      <button
        onClick={onProcess}
        disabled={isProcessing || selectedCount === 0}
        className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
      >
        {isProcessing ? (
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
);

export default PayoutActionsPanel;
