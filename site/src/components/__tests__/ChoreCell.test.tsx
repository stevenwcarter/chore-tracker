import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import ChoreCell, { CELL_BOX } from '../ChoreCell';
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

  it('renders a pending pill with no notes affordance when there are none', () => {
    render(
      <ChoreCell
        {...baseProps}
        completion={completion({ approved: false })}
        isScheduled
        isCompletedByAnyone={false}
      />,
    );
    expect(screen.getByTitle('Pending approval')).toHaveTextContent('?');
  });

  // The visible note count used to render on its own line beneath the marker,
  // which made cells with notes taller than cells without and knocked the grid
  // out of alignment. Notes now live in the marker's tooltip and in
  // ChoreCompletionDetail; nothing in the cell may grow to accommodate them.
  it('folds note text into the marker tooltip instead of a separate count line', () => {
    const { container } = render(
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

    // Asserted as a raw attribute rather than via getByTitle, which normalises
    // the newline away - the line break between status and notes is the point.
    const marker = container.firstElementChild;
    expect(marker).toHaveAttribute('title', 'Pending approval\nhi');
    expect(marker).toHaveTextContent('?');
    expect(screen.queryByText(/📝/)).not.toBeInTheDocument();
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

  // Every state must render into the one CELL_BOX geometry, so that markers line
  // up vertically down a column and no state is taller than another. A state
  // that restates its own sizing - as the claim button once did, omitting
  // `mx-auto` - silently breaks the scannability of the whole grid.
  describe('column alignment', () => {
    const notesFor = (text: string) => [
      {
        id: 1,
        choreCompletionId: 9,
        noteText: text,
        authorType: AuthorType.Admin,
        visibleToUser: true,
        createdAt: '2026-08-19T00:00:00Z',
      },
    ];

    const states: [string, Partial<React.ComponentProps<typeof ChoreCell>>][] = [
      ['unscheduled spacer', { completion: null, isScheduled: false, isCompletedByAnyone: false }],
      [
        'approved marker',
        {
          completion: completion({ approved: true }),
          isScheduled: true,
          isCompletedByAnyone: false,
        },
      ],
      [
        'pending marker',
        {
          completion: completion({ approved: false }),
          isScheduled: true,
          isCompletedByAnyone: false,
        },
      ],
      [
        'pending marker carrying notes',
        {
          completion: completion({ approved: false, notes: notesFor('hi') }),
          isScheduled: true,
          isCompletedByAnyone: false,
        },
      ],
      ['done by someone else', { completion: null, isScheduled: true, isCompletedByAnyone: true }],
      ['claim button', { completion: null, isScheduled: true, isCompletedByAnyone: false }],
      [
        'claim button for a future date',
        {
          completion: null,
          isScheduled: true,
          isCompletedByAnyone: false,
          date: new Date(Date.now() + 86_400_000),
        },
      ],
    ];

    // The it.each below checks every state against CELL_BOX, so it would still
    // pass if CELL_BOX itself lost its centring. Pin the mechanism separately.
    it('centres the box horizontally at a fixed size', () => {
      expect(CELL_BOX.split(' ')).toEqual(expect.arrayContaining(['mx-auto', 'w-8', 'h-8']));
    });

    it.each(states)('%s shares the common cell box', (_label, props) => {
      const { container } = render(
        <ChoreCell
          {...baseProps}
          completion={null}
          isScheduled={false}
          isCompletedByAnyone={false}
          {...props}
        />,
      );

      const root = container.firstElementChild;
      expect(root).not.toBeNull();
      for (const cls of CELL_BOX.split(' ')) {
        expect(root).toHaveClass(cls);
      }
    });

    it('renders exactly one element per cell, so no state is taller than another', () => {
      for (const [, props] of states) {
        const { container, unmount } = render(
          <ChoreCell
            {...baseProps}
            completion={null}
            isScheduled={false}
            isCompletedByAnyone={false}
            {...props}
          />,
        );
        expect(container.childElementCount).toBe(1);
        expect(container.firstElementChild?.childElementCount).toBe(0);
        unmount();
      }
    });
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
