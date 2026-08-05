import React from 'react';
import { formatCurrency } from '../utils/dateUtils';

interface PayoutSummaryCardsProps {
  userCount: number;
  totalUnpaidAmount: number;
  selectedTotal: number;
}

export const PayoutSummaryCards: React.FC<PayoutSummaryCardsProps> = ({
  userCount,
  totalUnpaidAmount,
  selectedTotal,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="bg-blue-900 p-4 rounded-lg border-l-4 border-blue-500">
      <h3 className="font-semibold text-blue-100">Users with Unpaid Chores</h3>
      <p className="text-2xl font-bold text-blue-100">{userCount}</p>
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
);

export default PayoutSummaryCards;
