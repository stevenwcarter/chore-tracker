import React from 'react';
import clsx from 'clsx';
import { Chore, ChoreCompletion } from '../types/chore';
import { celebrateOnSuccess } from '../utils/celebrate';

interface ChoreCellProps {
  chore: Chore;
  date: Date;
  completion: ChoreCompletion | null;
  isScheduled: boolean;
  isCompletedByAnyone: boolean;
  onSelectCompletion: (completion: ChoreCompletion) => void;
  onCompleteChore: (choreId: number, date: Date) => Promise<void>;
}

/** Joins a completion's notes into a tooltip string, or '' when there are none. */
const notesTooltip = (completion: ChoreCompletion | null): string => {
  if (!completion?.notes?.length) return '';
  return completion.notes.map((note) => note.noteText).join('\n');
};

export const ChoreCell: React.FC<ChoreCellProps> = ({
  chore,
  date,
  completion,
  isScheduled,
  isCompletedByAnyone,
  onSelectCompletion,
  onCompleteChore,
}) => {
  if (!isScheduled) {
    return <div className="w-8 h-8"></div>;
  }

  if (completion) {
    return (
      <div className="space-y-2">
        <div
          className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center cursor-pointer ${
            completion.approved ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
          }`}
          onClick={() => onSelectCompletion(completion)}
          title={completion.approved ? 'Approved' : 'Pending approval'}
        >
          {completion.approved ? '✓' : '?'}
        </div>
        {completion.notes && completion.notes.length > 0 && (
          <div className="text-xs text-blue-400" title={notesTooltip(completion)}>
            📝 {completion.notes.length}
          </div>
        )}
      </div>
    );
  }

  if (isCompletedByAnyone) {
    return (
      <div className="w-8 h-8 rounded-full mx-auto flex items-center justify-center bg-gray-500 text-white">
        ✓
      </div>
    );
  }

  const isFutureDate = date.getTime() > new Date().getTime();

  const displayClasses = clsx(
    'w-8 h-8 rounded-full border-2 border-gray-500 hover:border-blue-500 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center text-gray-300',
    !isFutureDate ? 'hover:bg-blue-600' : 'hover:bg-red-700 cursor-not-allowed',
  );

  const handleComplete = () => celebrateOnSuccess(() => onCompleteChore(chore.id, date));

  return (
    <button
      onClick={handleComplete}
      disabled={isFutureDate}
      className={displayClasses}
      title="Mark as completed"
    >
      +
    </button>
  );
};

export default ChoreCell;
