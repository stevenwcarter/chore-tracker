import React from 'react';
import { Chore } from '../types/chore';
import { formatCurrency } from '../utils/dateUtils';

interface ChoreCardProps {
  chore: Chore;
  onManage: (chore: Chore) => void;
}

export const ChoreCard: React.FC<ChoreCardProps> = ({ chore, onManage }) => {
  return (
    <div className="bg-gray-800 text-white p-4 sm:p-6 rounded-lg shadow-md border border-gray-700">
      {/* Mobile: Stack vertically, Desktop: Side by side */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-white break-words">
            {chore.name}
          </h3>
          {chore.description && (
            <p className="text-gray-300 text-sm mt-1 break-words">{chore.description}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={() => onManage(chore)}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors font-medium"
          >
            Manage
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Amount:</span>
          <span className="font-semibold text-white">{formatCurrency(chore.amountCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Payment:</span>
          <span className="text-white">{chore.paymentType}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Status:</span>
          <span
            className={`px-2 py-1 rounded text-xs ${
              chore.isActive ? 'bg-green-600 text-green-100' : 'bg-red-600 text-red-100'
            }`}
          >
            {chore.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {chore.assignedUsers && chore.assignedUsers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-600">
          <p className="text-sm text-gray-400 mb-2">Assigned to:</p>
          <div className="flex flex-wrap gap-2">
            {chore.assignedUsers.map((user) => (
              <span key={user.id} className="px-2 py-1 bg-gray-600 text-gray-200 rounded text-xs">
                {user.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChoreCard;
