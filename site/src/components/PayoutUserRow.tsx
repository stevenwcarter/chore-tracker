import React from 'react';
import { UnpaidTotal } from '../types/chore';
import { formatCents } from '../utils/currency';

interface PayoutUserRowProps {
  total: UnpaidTotal;
  selected: boolean;
  onToggle: (userId: number) => void;
}

export const PayoutUserRow: React.FC<PayoutUserRowProps> = ({ total, selected, onToggle }) => (
  <div
    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
      selected ? 'bg-blue-900 border-blue-600' : 'bg-gray-900 border-gray-600 hover:bg-gray-700'
    }`}
  >
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(total.user.id)}
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
        {formatCents(total.amountCents)}
      </p>
      {total.amountCents === 0 && <p className="text-xs text-gray-500">No unpaid chores</p>}
    </div>
  </div>
);

export default PayoutUserRow;
