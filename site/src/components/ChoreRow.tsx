import React from 'react';
import { WeeklyChoreData, ChoreCompletion, PaymentType } from '../types/chore';
import { formatCents } from '../utils/currency';
import { isSameDayAsString } from '../utils/dateUtils';
import { isDayInBitmask } from '../utils/weekdayBitmask';
import { isDateInWindow } from '../utils/availabilityWindow';
import ChoreCell from './ChoreCell';

interface ChoreRowProps {
  choreData: WeeklyChoreData;
  dates: Date[];
  onCompleteChore: (choreId: number, date: Date) => Promise<void>;
  onSelectCompletion: (completion: ChoreCompletion) => void;
  isChoreCompletedByAnyone: (choreId: number, date: Date) => boolean;
  currentDate?: Date; // For mobile single-day view
  isMobile?: boolean;
}

export const ChoreRow: React.FC<ChoreRowProps> = ({
  choreData,
  dates,
  onCompleteChore,
  onSelectCompletion,
  isChoreCompletedByAnyone,
  currentDate,
  isMobile = false,
}) => {
  const getCompletionForDate = (date: Date): ChoreCompletion | null => {
    return (
      choreData.completions.find((completion) => {
        return isSameDayAsString(date, completion.completedDate);
      }) || null
    );
  };

  if (isMobile && currentDate) {
    // A day is offered only when the chore is scheduled for that weekday AND the
    // date falls inside the chore's yearly availability window. Out-of-season days
    // render exactly like unscheduled ones. The server enforces the same rule in
    // ChoreCompletionSvc::create - this is only the affordance.
    const isScheduled =
      isDayInBitmask(choreData.chore.requiredDays, currentDate) &&
      isDateInWindow(choreData.chore.availabilityWindow, currentDate);

    // Mobile layout - show chore info and single date
    return (
      <div className="bg-gray-700 p-4 rounded-lg mb-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-medium text-white">{choreData.chore.name}</h3>
            {choreData.chore.description && (
              <p className="text-sm text-gray-300">{choreData.chore.description}</p>
            )}
            <p className="text-sm text-green-400 font-medium">
              {formatCents(choreData.chore.amountCents)}
              {choreData.chore.paymentType === PaymentType.Weekly && ' (weekly)'}
            </p>
          </div>
          <div className="flex items-center justify-center ml-4">
            <ChoreCell
              chore={choreData.chore}
              date={currentDate}
              completion={getCompletionForDate(currentDate)}
              isScheduled={isScheduled}
              isCompletedByAnyone={isChoreCompletedByAnyone(choreData.chore.id, currentDate)}
              onSelectCompletion={onSelectCompletion}
              onCompleteChore={onCompleteChore}
            />
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout - table row
  return (
    <tr className="hover:bg-gray-700">
      <td className="p-3 border-b border-gray-600">
        <div>
          <div className="font-medium text-white">{choreData.chore.name}</div>
          {choreData.chore.description && (
            <div className="text-sm text-gray-300">{choreData.chore.description}</div>
          )}
          <div className="text-sm text-green-400 font-medium">
            {formatCents(choreData.chore.amountCents)}
            {choreData.chore.paymentType === PaymentType.Weekly && ' (weekly)'}
          </div>
        </div>
      </td>
      {dates.map((date, dateIndex) => {
        // A day is offered only when the chore is scheduled for that weekday AND the
        // date falls inside the chore's yearly availability window. Out-of-season days
        // render exactly like unscheduled ones. The server enforces the same rule in
        // ChoreCompletionSvc::create - this is only the affordance.
        const isScheduled =
          isDayInBitmask(choreData.chore.requiredDays, date) &&
          isDateInWindow(choreData.chore.availabilityWindow, date);

        return (
          <td key={dateIndex} className="p-3 border-b border-gray-600 text-center">
            <div className="relative">
              <ChoreCell
                chore={choreData.chore}
                date={date}
                completion={getCompletionForDate(date)}
                isScheduled={isScheduled}
                isCompletedByAnyone={isChoreCompletedByAnyone(choreData.chore.id, date)}
                onSelectCompletion={onSelectCompletion}
                onCompleteChore={onCompleteChore}
              />
            </div>
          </td>
        );
      })}
    </tr>
  );
};

export default ChoreRow;
