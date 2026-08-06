import React from 'react';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Days offered for `month`. February offers 29 because a window boundary is a
 * month/day pair with no year - it has no leap year to be valid or invalid in.
 * This must match `MonthDay::days_in_month` in `src/availability.rs`.
 */
const daysInMonth = (month: number): number => {
  if (month === 2) return 29;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

interface MonthDayPickerProps {
  /** Human label, e.g. "Available from". Also drives the two select labels. */
  label: string;
  month: number;
  day: number;
  onChange: (month: number, day: number) => void;
  disabled?: boolean;
}

const selectClasses =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';

export const MonthDayPicker: React.FC<MonthDayPickerProps> = ({
  label,
  month,
  day,
  onChange,
  disabled = false,
}) => {
  const monthId = `${label.replace(/\s+/g, '-').toLowerCase()}-month`;
  const dayId = `${label.replace(/\s+/g, '-').toLowerCase()}-day`;

  const handleMonthChange = (nextMonth: number) => {
    // Clamp the day so switching from Mar 31 to February cannot leave an
    // impossible pair behind.
    onChange(nextMonth, Math.min(day, daysInMonth(nextMonth)));
  };

  return (
    <div>
      <div className="block text-sm font-medium text-gray-700 mb-1">{label}</div>
      <div className="flex gap-2">
        <label htmlFor={monthId} className="sr-only">
          {label} month
        </label>
        <select
          id={monthId}
          aria-label={`${label} month`}
          value={month}
          onChange={(e) => handleMonthChange(Number(e.target.value))}
          className={selectClasses}
          disabled={disabled}
        >
          {MONTHS.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        <label htmlFor={dayId} className="sr-only">
          {label} day
        </label>
        <select
          id={dayId}
          aria-label={`${label} day`}
          value={day}
          onChange={(e) => onChange(month, Number(e.target.value))}
          className={selectClasses}
          disabled={disabled}
        >
          {Array.from({ length: daysInMonth(month) }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MonthDayPicker;
