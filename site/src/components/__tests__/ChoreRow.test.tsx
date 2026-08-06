import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChoreRow from '../ChoreRow';
import { PaymentType, WeeklyChoreData } from 'types/chore';
import { WEEKDAY_BITS } from 'utils/weekdayBitmask';

const EVERY_DAY = Object.values(WEEKDAY_BITS).reduce((a, b) => a | b, 0);

const choreData = (availabilityWindow: unknown): WeeklyChoreData =>
  ({
    chore: {
      id: 1,
      uuid: 'chore-1',
      name: 'Study spelling',
      description: null,
      amountCents: 100,
      paymentType: PaymentType.Daily,
      requiredDays: EVERY_DAY,
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
      createdByAdminId: 1,
      availabilityWindow,
    },
    completions: [],
  }) as unknown as WeeklyChoreData;

const renderRow = (data: WeeklyChoreData, day: Date) =>
  render(
    <table>
      <tbody>
        <ChoreRow
          choreData={data}
          dates={[day]}
          onCompleteChore={vi.fn()}
          onSelectCompletion={vi.fn()}
          isChoreCompletedByAnyone={() => false}
        />
      </tbody>
    </table>,
  );

const SCHOOL_YEAR = { startMonth: 9, startDay: 1, endMonth: 6, endDay: 15 };

describe('ChoreRow availability window', () => {
  it('renders a complete button on an in-season day', () => {
    renderRow(choreData(SCHOOL_YEAR), new Date(2026, 9, 20)); // Oct 20
    expect(screen.getByTitle('Mark as completed')).toBeInTheDocument();
  });

  it('renders no complete button on an out-of-season day', () => {
    renderRow(choreData(SCHOOL_YEAR), new Date(2026, 6, 4)); // Jul 4
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
  });

  it('renders a complete button on the inclusive end boundary', () => {
    renderRow(choreData(SCHOOL_YEAR), new Date(2027, 5, 15)); // Jun 15
    expect(screen.getByTitle('Mark as completed')).toBeInTheDocument();
  });

  it('renders a complete button for a chore with no window', () => {
    renderRow(choreData(null), new Date(2026, 6, 4)); // Jul 4
    expect(screen.getByTitle('Mark as completed')).toBeInTheDocument();
  });
});
