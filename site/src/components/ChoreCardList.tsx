import React from 'react';
import { WeeklyChoreData, ChoreCompletion } from '../types/chore';
import ChoreRow from './ChoreRow';

interface ChoreCardListProps {
  weeklyChoreData: WeeklyChoreData[];
  currentDate: Date;
  onCompleteChore: (choreId: number, date: Date) => Promise<void>;
  onSelectCompletion: (completion: ChoreCompletion) => void;
  isChoreCompletedByAnyone: (choreId: number, date: Date) => boolean;
}

/** Mobile weekly chore list: one card per chore, showing only `currentDate`. */
export const ChoreCardList: React.FC<ChoreCardListProps> = ({
  weeklyChoreData,
  currentDate,
  onCompleteChore,
  onSelectCompletion,
  isChoreCompletedByAnyone,
}) => {
  return (
    <div className="space-y-4">
      {weeklyChoreData.map((choreData) => (
        <ChoreRow
          key={choreData.chore.id}
          choreData={choreData}
          dates={[currentDate]}
          onCompleteChore={onCompleteChore}
          onSelectCompletion={onSelectCompletion}
          isChoreCompletedByAnyone={isChoreCompletedByAnyone}
          currentDate={currentDate}
          isMobile={true}
        />
      ))}
    </div>
  );
};

export default ChoreCardList;
