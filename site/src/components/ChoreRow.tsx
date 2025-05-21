import React from 'react';
import { WeeklyChoreData, ChoreCompletion, PaymentType } from '../types/chore';
import { formatCurrency, isSameDayAsString } from '../utils/dateUtils';

interface ChoreRowProps {
  choreData: WeeklyChoreData;
  dates: Date[];
  onCompleteChore: (choreId: number, amountCents: number, date: Date) => void;
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
        return isSameDayAsString(date, completion.completedAt);
      }) || null
    );
  };

  const isChoreScheduledForDay = (daysOfWeek: number[], date: Date): boolean => {
    return daysOfWeek.includes(date.getDay());
  };

  const renderChoreCell = (date: Date) => {
    const completion = getCompletionForDate(date);
    const isScheduled = isChoreScheduledForDay(choreData.chore.daysOfWeek, date);
    const isCompletedByAnyone = isChoreCompletedByAnyone(choreData.chore.id, date);

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
            <div className="text-xs text-blue-400">📝 {completion.notes.length}</div>
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

    return (
      <button
        onClick={() => onCompleteChore(choreData.chore.id, choreData.chore.amountCents, date)}
        className="w-8 h-8 rounded-full border-2 border-gray-500 hover:border-blue-500 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center text-gray-300"
        title="Mark as completed"
      >
        +
      </button>
    );
  };

  if (isMobile && currentDate) {
    // Mobile layout - show chore info and single date
    return (
      <div className="bg-gray-700 p-4 rounded-lg mb-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-medium text-white">{choreData.chore.title}</h3>
            {choreData.chore.description && (
              <p className="text-sm text-gray-300">{choreData.chore.description}</p>
            )}
            <p className="text-sm text-green-400 font-medium">
              {formatCurrency(choreData.chore.amountCents)}
              {choreData.chore.paymentType === PaymentType.Weekly && ' (weekly)'}
            </p>
          </div>
          <div className="flex items-center justify-center ml-4">
            {renderChoreCell(currentDate)}
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
          <div className="font-medium text-white">{choreData.chore.title}</div>
          {choreData.chore.description && (
            <div className="text-sm text-gray-300">{choreData.chore.description}</div>
          )}
          <div className="text-sm text-green-400 font-medium">
            {formatCurrency(choreData.chore.amountCents)}
            {choreData.chore.paymentType === PaymentType.Weekly && ' (weekly)'}
          </div>
        </div>
      </td>
      {dates.map((date, dateIndex) => (
        <td key={dateIndex} className="p-3 border-b border-gray-600 text-center">
          <div className="relative">{renderChoreCell(date)}</div>
        </td>
      ))}
    </tr>
  );
};

export default ChoreRow;
