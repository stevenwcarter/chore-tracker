import React from 'react';
import { WeeklyChoreData, ChoreCompletion } from '../types/chore';
import ChoreGridHeader from './ChoreGridHeader';
import ChoreRow from './ChoreRow';

interface ChoreGridProps {
  weeklyChoreData: WeeklyChoreData[];
  dates: Date[];
  onCompleteChore: (choreId: number, date: Date) => Promise<void>;
  onSelectCompletion: (completion: ChoreCompletion) => void;
  isChoreCompletedByAnyone: (choreId: number, date: Date) => boolean;
}

/**
 * Desktop weekly chore table: a header row of dates plus one ChoreRow per chore.
 *
 * `table-fixed` is load-bearing, not cosmetic. With the browser's default auto
 * layout a long chore name widens the first column and pushes Saturday off the
 * right edge of a kiosk display. Fixed layout makes the column widths come from
 * the header alone (see ChoreGridHeader), so the seven day columns always divide
 * the container evenly and the whole week stays on screen at any width.
 */
export const ChoreGrid: React.FC<ChoreGridProps> = ({
  weeklyChoreData,
  dates,
  onCompleteChore,
  onSelectCompletion,
  isChoreCompletedByAnyone,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <ChoreGridHeader dates={dates} />
        <tbody>
          {weeklyChoreData.map((choreData) => (
            <ChoreRow
              key={choreData.chore.id}
              choreData={choreData}
              dates={dates}
              onCompleteChore={onCompleteChore}
              onSelectCompletion={onSelectCompletion}
              isChoreCompletedByAnyone={isChoreCompletedByAnyone}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ChoreGrid;
