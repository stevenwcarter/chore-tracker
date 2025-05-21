import { WeekDateRange } from '../types/chore';

export function getWeekStartDate(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Subtract days since Sunday
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

export function getWeekEndDate(weekStart: Date): Date {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

export function getWeekDateRange(date: Date = new Date()): WeekDateRange {
  const start = getWeekStartDate(date);
  const end = getWeekEndDate(start);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + i);
    dates.push(dayDate);
  }

  return { start, end, dates };
}

export function formatDateForGraphQL(date: Date): string {
  // Format date in local timezone to avoid UTC conversion issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCurrency(amountCents: number): string {
  return (amountCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString();
}

export function isSameDayAsString(date: Date, dateString: string): boolean {
  // Parse the date string in local timezone to avoid UTC conversion
  const [year, month, day] = dateString.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day); // month is 0-indexed
  return isSameDay(date, parsedDate);
}

export function getNextWeek(currentWeekStart: Date): Date {
  const nextWeek = new Date(currentWeekStart);
  nextWeek.setDate(currentWeekStart.getDate() + 7);
  return nextWeek;
}

export function getPreviousWeek(currentWeekStart: Date): Date {
  const prevWeek = new Date(currentWeekStart);
  prevWeek.setDate(currentWeekStart.getDate() - 7);
  return prevWeek;
}
