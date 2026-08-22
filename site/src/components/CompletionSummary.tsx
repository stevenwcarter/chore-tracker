import React from 'react';
import { ChoreCompletion } from '../types/chore';
import { formatCents } from '../utils/currency';

interface CompletionSummaryProps {
  completion: ChoreCompletion;
}

export const CompletionSummary: React.FC<CompletionSummaryProps> = ({ completion }) => {
  return (
    <>
      <div>
        <p className="text-sm text-gray-400">Status:</p>
        <p className={`font-medium ${completion.approved ? 'text-green-400' : 'text-yellow-400'}`}>
          {completion.approved ? 'Approved' : 'Pending Approval'}
        </p>
      </div>

      {completion.chore && (
        <div>
          <p className="text-sm text-gray-400">Chore:</p>
          <p className="font-medium text-white">{completion.chore.name || 'Unknown Chore'}</p>
        </div>
      )}

      {completion.user && (
        <div>
          <p className="text-sm text-gray-400">User:</p>
          <p className="font-medium text-white">{completion.user.name}</p>
        </div>
      )}

      <div>
        <p className="text-sm text-gray-400">Completed Date:</p>
        <p className="font-medium text-white">{completion.completedDate}</p>
      </div>

      <div>
        <p className="text-sm text-gray-400">Amount:</p>
        <p className="font-medium text-green-400">{formatCents(completion.amountCents)}</p>
      </div>
    </>
  );
};

export default CompletionSummary;
