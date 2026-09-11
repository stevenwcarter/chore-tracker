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

/**
 * The single box every cell state renders into - the unscheduled spacer, the
 * approved and pending markers, the grey "someone else did it" tick, and the
 * claim button alike.
 *
 * Sharing one box is what keeps a column scannable: every marker lands on the
 * same vertical line and every cell is exactly one marker tall. Previously the
 * markers carried `mx-auto` but the claim button did not, and because the button
 * is `flex` (a block-level box) the enclosing `text-center` could not centre it
 * either - so `+` sat left of the ticks above and below it. Any new state must
 * build on this constant rather than restate its own geometry.
 */
export const CELL_BOX = 'w-8 h-8 mx-auto flex items-center justify-center';

/** Joins a completion's notes into a tooltip string, or '' when there are none. */
const notesTooltip = (completion: ChoreCompletion | null): string => {
  if (!completion?.notes?.length) return '';
  return completion.notes.map((note) => note.noteText).join('\n');
};

/**
 * The marker's tooltip: approval status, plus the notes when there are any.
 *
 * Notes deliberately have no visible affordance in the grid - a count line under
 * the marker made cells with notes taller than cells without, breaking the
 * alignment above. The full list is one tap away in ChoreCompletionDetail.
 */
const completionTooltip = (completion: ChoreCompletion): string => {
  const status = completion.approved ? 'Approved' : 'Pending approval';
  const notes = notesTooltip(completion);
  return notes ? `${status}\n${notes}` : status;
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
    return <div className={CELL_BOX}></div>;
  }

  if (completion) {
    return (
      <div
        className={clsx(
          CELL_BOX,
          'rounded-full cursor-pointer',
          completion.approved ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white',
        )}
        onClick={() => onSelectCompletion(completion)}
        title={completionTooltip(completion)}
      >
        {completion.approved ? '✓' : '?'}
      </div>
    );
  }

  if (isCompletedByAnyone) {
    return <div className={clsx(CELL_BOX, 'rounded-full bg-gray-500 text-white')}>✓</div>;
  }

  const isFutureDate = date.getTime() > new Date().getTime();

  const displayClasses = clsx(
    CELL_BOX,
    'rounded-full border-2 border-gray-500 hover:border-blue-500 hover:text-white transition-colors text-gray-300',
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
