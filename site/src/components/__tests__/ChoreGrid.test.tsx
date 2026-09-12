import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import ChoreGrid from '../ChoreGrid';
import { getWeekDateRange } from 'utils/dateUtils';
import { TODAY_COLUMN_TINT } from '../todayColumn';
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

describe('today highlighting', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Wednesday 2026-09-09, midday: inside the rendered week, and deliberately
    // not midnight so a naive timestamp comparison would fail.
    vi.setSystemTime(new Date(2026, 8, 9, 12, 0, 0));
  });

  afterEach(() => vi.useRealTimers());

  /** Indices into the seven day columns (the "Chore" header is dropped). */
  const dayHeaders = () => screen.getAllByRole('columnheader').slice(1);

  it('marks exactly one day column as today', () => {
    renderGrid(data);

    const marked = dayHeaders().filter((th) => th.getAttribute('aria-current') === 'date');
    expect(marked).toHaveLength(1);
    expect(within(marked[0]).getByText('Sep 9')).toBeInTheDocument();
  });

  it('exposes today by text as well as by colour', () => {
    renderGrid(data);

    // Colour alone would leave nothing for a screen reader, or for anyone who
    // cannot pick the tint out of the surrounding grey.
    const marked = dayHeaders().find((th) => th.getAttribute('aria-current') === 'date');
    expect(within(marked!).getByText('Today')).toHaveClass('sr-only');
    // The weekday itself is unchanged - all seven columns still read alike.
    expect(within(marked!).getByText('Wed')).toBeInTheDocument();
  });

  // The point of the feature is a column you can follow down the grid, so the
  // header and the body cells beneath it must agree on WHICH column. Tinting
  // the header alone, or drifting by one, would defeat it.
  it('tints the same column in the header and in every body row', () => {
    const { container } = renderGrid(data);

    const tintedHeader = dayHeaders().findIndex((th) => th.className.includes(TODAY_COLUMN_TINT));
    expect(tintedHeader).toBe(3); // Sun, Mon, Tue, [Wed]

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const dayCells = [...row.querySelectorAll('td')].slice(1);
      const tinted = dayCells
        .map((td, i) => (td.className.includes(TODAY_COLUMN_TINT) ? i : -1))
        .filter((i) => i >= 0);
      expect(tinted).toEqual([tintedHeader]);
    }
  });

  it('marks no column when the week being viewed is not the current one', () => {
    vi.setSystemTime(new Date(2026, 9, 21, 12, 0, 0)); // a month later
    const { container } = renderGrid(data);

    expect(dayHeaders().some((th) => th.getAttribute('aria-current') === 'date')).toBe(false);
    expect(container.querySelector(`[class*="${TODAY_COLUMN_TINT}"]`)).toBeNull();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });
});
