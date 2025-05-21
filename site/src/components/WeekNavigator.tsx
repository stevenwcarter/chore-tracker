import React from 'react';
import {
  formatDateForDisplay,
  getWeekDateRange,
  getNextWeek,
  getPreviousWeek,
} from '../utils/dateUtils';

interface WeekNavigatorProps {
  currentWeekStart: Date;
  onWeekChange: (newWeekStart: Date) => void;
  weekRange: { start: Date; end: Date };
  isMobile?: boolean;
}

export const WeekNavigator: React.FC<WeekNavigatorProps> = ({
  currentWeekStart,
  onWeekChange,
  weekRange,
  isMobile = false,
}) => {
  const buttonClass = isMobile
    ? 'px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors'
    : 'px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors';

  const thisWeekButtonClass = isMobile
    ? 'px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors'
    : 'px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors';

  if (isMobile) {
    return (
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => onWeekChange(getPreviousWeek(currentWeekStart))}
          className={buttonClass}
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-gray-300 text-sm">
            {formatDateForDisplay(weekRange.start)} - {formatDateForDisplay(weekRange.end)}
          </p>
        </div>
        <button onClick={() => onWeekChange(getNextWeek(currentWeekStart))} className={buttonClass}>
          →
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => onWeekChange(getPreviousWeek(currentWeekStart))}
        className={buttonClass}
      >
        ← Previous
      </button>
      <button
        onClick={() => onWeekChange(getWeekDateRange().start)}
        className={thisWeekButtonClass}
      >
        This Week
      </button>
      <button onClick={() => onWeekChange(getNextWeek(currentWeekStart))} className={buttonClass}>
        Next →
      </button>
    </div>
  );
};

export default WeekNavigator;
