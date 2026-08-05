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

/** Desktop weekly chore table: a header row of dates plus one ChoreRow per chore. */
export const ChoreGrid: React.FC<ChoreGridProps> = ({
  weeklyChoreData,
  dates,
  onCompleteChore,
  onSelectCompletion,
  isChoreCompletedByAnyone,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
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
