import React from 'react';
import { ChoreCompletion } from '../types/chore';
import { formatCurrency } from '../utils/dateUtils';

interface CompletionCardProps {
  completion: ChoreCompletion;
  onViewDetails: (completion: ChoreCompletion) => void;
  onApprove?: (completion: ChoreCompletion) => void;
  onReject?: (completion: ChoreCompletion) => void;
  showActions?: boolean;
}

export const CompletionCard: React.FC<CompletionCardProps> = ({
  completion,
  onViewDetails,
  onApprove,
  onReject,
  showActions = false,
}) => {
  const borderColor = completion.approved ? 'border-green-500' : 'border-yellow-500';

  return (
    <div className={`bg-gray-700 p-4 rounded-lg border ${borderColor}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-semibold text-white">{completion.chore?.name || 'Unknown Chore'}</h4>
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
        <div className="flex gap-2">
          <button
            onClick={() => onViewDetails(completion)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
          >
            View Details
          </button>
          {showActions && !completion.approved && (
            <>
              {onApprove && (
                <button
                  onClick={() => onApprove(completion)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                >
                  ✓ Approve
                </button>
              )}
              {onReject && (
                <button
                  onClick={() => onReject(completion)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                >
                  ✗ Reject
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompletionCard;
