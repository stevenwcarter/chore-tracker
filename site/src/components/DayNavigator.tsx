import React from 'react';
import { formatDateForDisplay } from '../utils/dateUtils';

interface DayNavigatorProps {
  currentDate: Date;
  weekDates: Date[];
  onDateChange: (date: Date) => void;
}

export const DayNavigator: React.FC<DayNavigatorProps> = ({
  currentDate,
  weekDates,
  onDateChange,
}) => {
  const currentIndex = weekDates.findIndex(
    (date) => date.toDateString() === currentDate.toDateString(),
  );

  const goToPreviousDay = () => {
    if (currentIndex > 0) {
      onDateChange(weekDates[currentIndex - 1]);
    }
  };

  const goToNextDay = () => {
    if (currentIndex < weekDates.length - 1) {
      onDateChange(weekDates[currentIndex + 1]);
    }
  };

  return (
    <div className="flex justify-between items-center mb-4 bg-gray-700 p-3 rounded-lg">
      <button
        onClick={goToPreviousDay}
        disabled={currentIndex <= 0}
        className="px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded text-sm transition-colors"
      >
        ← Previous
      </button>
      <div className="text-center">
        <p className="text-white font-medium">{formatDateForDisplay(currentDate)}</p>
        <p className="text-gray-300 text-sm">
          {currentIndex + 1} of {weekDates.length}
        </p>
      </div>
      <button
        onClick={goToNextDay}
        disabled={currentIndex >= weekDates.length - 1}
        className="px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded text-sm transition-colors"
      >
        Next →
      </button>
    </div>
  );
};

export default DayNavigator;
