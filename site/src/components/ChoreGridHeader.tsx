import React from 'react';
import { formatDateForDisplay, formatDateParts } from '../utils/dateUtils';

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

  // Desktop view shows all dates. The date is stacked - weekday over month/day -
  // rather than written on one line, so that seven columns fit a narrow kiosk
  // display without horizontal scrolling. Widths are percentages, not minimums:
  // paired with `table-fixed` on the table itself (see ChoreGrid), the chore
  // column takes a fixed share and the seven days split the rest evenly, so the
  // grid always spans exactly its container no matter how long a chore name is.
  return (
    <thead>
      <tr>
        <th className="w-[30%] text-left p-3 border-b border-gray-600 font-semibold text-gray-300">
          Chore
        </th>
        {dates.map((date, index) => {
          const { weekday, monthDay } = formatDateParts(date);
          return (
            <th
              key={index}
              className="text-center px-1 py-2 border-b border-gray-600 font-semibold text-gray-300"
            >
              <div className="leading-tight">{weekday}</div>
              <div className="text-xs font-normal text-gray-400 leading-tight">{monthDay}</div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
};

export default ChoreGridHeader;
