import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import ChoreGrid from '../ChoreGrid';
import { getWeekDateRange } from 'utils/dateUtils';
import { Chore, PaymentType, WeeklyChoreData } from 'types/chore';

const chore = (overrides: Partial<Chore> = {}): Chore =>
  ({
    id: 1,
    uuid: 'chore-1',
    name: 'Dishes',
    amountCents: 100,
    paymentType: PaymentType.Daily,
    requiredDays: 127,
    createdAt: '2026-01-01T00:00:00Z',
    createdByAdminId: 1,
    availabilityWindow: null,
    ...overrides,
  }) as unknown as Chore;

const { dates } = getWeekDateRange(new Date(2026, 8, 6));

const renderGrid = (weeklyChoreData: WeeklyChoreData[]) =>
  render(
    <ChoreGrid
      weeklyChoreData={weeklyChoreData}
      dates={dates}
      onCompleteChore={vi.fn()}
      onSelectCompletion={vi.fn()}
      isChoreCompletedByAnyone={() => false}
    />,
  );

const data: WeeklyChoreData[] = [{ chore: chore(), completions: [] } as unknown as WeeklyChoreData];

describe('ChoreGrid layout', () => {
  it('stacks each date as a weekday over a month and day', () => {
    renderGrid(data);

    const headers = screen.getAllByRole('columnheader');
    // One chore column plus the seven days of the week.
    expect(headers).toHaveLength(8);

    const sunday = headers[1];
    expect(within(sunday).getByText('Sun')).toBeInTheDocument();
    expect(within(sunday).getByText('Sep 6')).toBeInTheDocument();
    // Stacked, not run together on one line - two separate elements.
    expect(sunday.querySelectorAll('div')).toHaveLength(2);
  });

  it('renders every day of the week, Sunday through Saturday', () => {
    renderGrid(data);

    const headers = screen.getAllByRole('columnheader').slice(1);
    expect(headers.map((th) => th.querySelector('div')?.textContent)).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ]);
  });

  // Auto table layout lets a long chore name widen the first column and push
  // Saturday off the right edge of a kiosk display. Fixed layout takes the
  // widths from the header alone, so the week always spans the container.
  it('uses a fixed layout so a long chore name cannot widen the table', () => {
    const { container } = renderGrid([
      {
        chore: chore({ name: 'Put away every single one of the clean dishes in the kitchen' }),
        completions: [],
      } as unknown as WeeklyChoreData,
    ]);

    expect(container.querySelector('table')).toHaveClass('table-fixed');
  });

  it('sizes columns by share rather than by pixel minimums', () => {
    renderGrid(data);

    for (const th of screen.getAllByRole('columnheader')) {
      expect(th.className).not.toMatch(/min-w-/);
    }
  });
});
