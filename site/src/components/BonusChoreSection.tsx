import React from 'react';
import confetti from 'canvas-confetti';
import { useBonusChores } from 'hooks/useBonusChores';
import { formatCurrency } from 'utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';

interface BonusChoreSectionProps {
  userId: number;
  today: string; // ISO 8601 YYYY-MM-DD
  onClaimChore: (choreId: number, date: Date) => Promise<void>;
  isChoreCompletedByAnyone: (choreId: number, date: Date) => boolean;
  isChoreCompletedByUser: (choreId: number, userId: number, date: Date) => boolean;
}

export const BonusChoreSection: React.FC<BonusChoreSectionProps> = ({
  userId,
  today,
  onClaimChore,
  isChoreCompletedByAnyone,
  isChoreCompletedByUser,
}) => {
  const { bonusChores, loading } = useBonusChores(today);

  if (loading) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-white mb-3">Bonus Chores</h3>
        <LoadingSpinner />
      </div>
    );
  }

  if (bonusChores.length === 0) {
    return null;
  }

  const todayDate = new Date(today + 'T00:00:00');

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-white mb-3">Bonus Chores</h3>
      <div className="flex flex-wrap gap-4">
        {bonusChores.map((chore) => {
          const alreadyClaimed =
            isChoreCompletedByUser(chore.id, userId, todayDate) ||
            (chore.maxClaims != null && isChoreCompletedByAnyone(chore.id, todayDate));

          const handleClaim = async () => {
            if (alreadyClaimed) return;
            try {
              await onClaimChore(chore.id, todayDate);
              confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
            } catch {
              // Error already handled and toasted by parent
            }
          };

          return (
            <div
              key={chore.uuid}
              className="bg-gray-700 rounded-lg p-4 flex flex-col gap-2 min-w-[180px] max-w-xs"
            >
              <div className="font-medium text-white">{chore.name}</div>
              <div className="text-green-400 font-semibold">
                {formatCurrency(chore.amountCents)}
              </div>
              <button
                onClick={handleClaim}
                disabled={alreadyClaimed}
                className={`mt-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  alreadyClaimed
                    ? 'bg-gray-600 text-gray-400 opacity-50 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {alreadyClaimed ? 'Already claimed' : 'Claim it!'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BonusChoreSection;
