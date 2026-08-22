import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import ChoreCell from '../ChoreCell';
import { AuthorType, Chore, ChoreCompletion, PaymentType } from 'types/chore';

// canvas-confetti is unmocked globally, and the ChoreCell -> celebrateOnSuccess
// chain is the sole point that decides whether it fires (see celebrate.ts).
vi.mock('canvas-confetti');
import confetti from 'canvas-confetti';

beforeEach(() => {
  vi.clearAllMocks();
});

const CHORE: Chore = {
  id: 1,
  uuid: 'chore-1',
  name: 'Dishes',
  amountCents: 100,
  paymentType: PaymentType.Daily,
  requiredDays: 127,
  createdAt: '2026-01-01T00:00:00Z',
  createdByAdminId: 1,
  availabilityWindow: null,
};

const baseProps = {
  chore: CHORE,
  date: new Date('2026-08-19T12:00:00'),
  onSelectCompletion: vi.fn(),
  onCompleteChore: vi.fn(),
};

const completion = (overrides: Partial<ChoreCompletion>): ChoreCompletion =>
  ({
    id: 9,
    uuid: 'completion-9',
    choreId: 1,
    userId: 1,
    completedDate: '2026-08-19',
    approved: false,
    amountCents: 100,
    chore: CHORE,
    notes: [],
    adminNotes: [],
    ...overrides,
  }) as unknown as ChoreCompletion;

describe('ChoreCell', () => {
  it('renders an empty spacer when the day is not scheduled', () => {
    const { container } = render(
      <ChoreCell
        {...baseProps}
        completion={null}
        isScheduled={false}
        isCompletedByAnyone={false}
      />,
    );
    expect(container.querySelector('.w-8.h-8')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an approved pill for an approved completion', () => {
    render(
      <ChoreCell
        {...baseProps}
        completion={completion({ approved: true })}
        isScheduled
        isCompletedByAnyone={false}
      />,
    );
    expect(screen.getByTitle('Approved')).toHaveTextContent('✓');
  });

  it('renders a pending pill and a note count when notes exist', () => {
    render(
      <ChoreCell
        {...baseProps}
        completion={completion({
          approved: false,
          notes: [
            {
              id: 1,
              choreCompletionId: 9,
              noteText: 'hi',
              authorType: AuthorType.Admin,
              visibleToUser: true,
              createdAt: '2026-08-19T00:00:00Z',
            },
          ],
        })}
        isScheduled
        isCompletedByAnyone={false}
      />,
    );
    expect(screen.getByTitle('Pending approval')).toHaveTextContent('?');
    expect(screen.getByTitle('hi')).toBeInTheDocument();
  });

  it('renders a grey check when someone else already did it', () => {
    render(<ChoreCell {...baseProps} completion={null} isScheduled isCompletedByAnyone />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a claim button that is disabled for future dates', () => {
    render(
      <ChoreCell
        {...baseProps}
        date={new Date(Date.now() + 86_400_000)}
        completion={null}
        isScheduled
        isCompletedByAnyone={false}
      />,
    );
    expect(screen.getByRole('button', { name: '+' })).toBeDisabled();
  });

  it('fires confetti when onCompleteChore resolves', async () => {
    const onCompleteChore = vi.fn().mockResolvedValue(undefined);
    render(
      <ChoreCell
        {...baseProps}
        onCompleteChore={onCompleteChore}
        completion={null}
        isScheduled
        isCompletedByAnyone={false}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '+' }));

    expect(onCompleteChore).toHaveBeenCalledWith(CHORE.id, baseProps.date);
    expect(confetti).toHaveBeenCalled();
  });

  it('does not fire confetti when onCompleteChore rejects', async () => {
    const onCompleteChore = vi.fn().mockRejectedValue(new Error('boom'));
    render(
      <ChoreCell
        {...baseProps}
        onCompleteChore={onCompleteChore}
        completion={null}
        isScheduled
        isCompletedByAnyone={false}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '+' }));

    expect(onCompleteChore).toHaveBeenCalled();
    expect(confetti).not.toHaveBeenCalled();
  });
});
