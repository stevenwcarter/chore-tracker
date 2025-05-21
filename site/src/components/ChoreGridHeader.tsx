import React from 'react';
import { formatDateForDisplay } from '../utils/dateUtils';

interface ChoreGridHeaderProps {
  dates: Date[];
  isMobile?: boolean;
}

export const ChoreGridHeader: React.FC<ChoreGridHeaderProps> = ({ dates, isMobile = false }) => {
  if (isMobile) {
    // Mobile view shows single date
    return (
      <div className="text-center p-3 border-b border-gray-600 font-semibold text-gray-300">
        {formatDateForDisplay(dates[0])}
      </div>
    );
  }

  // Desktop view shows all dates
  return (
    <thead>
      <tr>
        <th className="text-left p-3 border-b border-gray-600 font-semibold text-gray-300 min-w-[200px]">
          Chore
        </th>
        {dates.map((date, index) => (
          <th
            key={index}
            className="text-center p-3 border-b border-gray-600 font-semibold text-gray-300 min-w-[120px]"
          >
            <div>{formatDateForDisplay(date)}</div>
          </th>
        ))}
      </tr>
    </thead>
  );
};

export default ChoreGridHeader;
