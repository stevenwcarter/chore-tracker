import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import '@testing-library/jest-dom';
import WeeklyChoreView from '../WeeklyChoreView';
import {
  GET_USER_CHORES,
  GET_WEEKLY_CHORES,
  GET_ALL_WEEKLY_COMPLETIONS,
  GET_USER_BADGES,
  LIST_BONUS_CHORES,
} from 'graphql/queries';
import { Chore, ChoreCompletion, PaymentType, User, UserBadge } from 'types/chore';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// "Now" is pinned to Wed 2026-08-05 so the Sunday-start week (see dateUtils.ts) is
// deterministic: weekRange = Sun 2026-08-02 .. Sat 2026-08-08. Both the mobile
// "pinned to first day" and the desktop "selectedDate" initializer land on the
// same value -- weekRange.dates[0] = Sun 2026-08-02 -- so `currentDate` (and thus
// the bonus-chores `today` variable) is identical in both branches.
const WEEK_START = '2026-08-02';

const USER_KID: User = {
  id: 20,
  uuid: 'user-uuid-20',
  name: 'Kid',
  createdAt: '2026-01-01T00:00:00Z',
};

// Scheduled Sunday only (bit 64 = Sun; see the requiredDays doc on Chore in
// types/chore.ts and site/src/utils/weekdayBitmask.ts) so exactly one grid cell
// is "live" across the week -- every other day renders the empty unscheduled
// placeholder. That keeps the "completed by someone else" assertion unambiguous
// without needing to touch/interpret day-indexing logic at all.
const CHORE_DISHES: Chore = {
  id: 50,
  uuid: 'chore-uuid-50',
  name: 'Wash dishes',
  description: undefined,
  amountCents: 200,
  paymentType: PaymentType.Daily,
  requiredDays: 64,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  createdByAdminId: 1,
  availabilityWindow: null,
};

// Completed by a DIFFERENT user (id 99, not USER_KID) on the one scheduled day,
// and absent from GET_WEEKLY_CHORES (USER_KID's own completions, mocked empty
// below). That makes ChoreRow's own-completion lookup miss and fall through to
// isChoreCompletedByAnyone -- the grey "completed by someone else" checkmark,
// not the green "approved" one.
const OTHER_USER_COMPLETION: ChoreCompletion = {
  id: 900,
  uuid: 'completion-uuid-900',
  choreId: 50,
  userId: 99,
  completedDate: WEEK_START,
  approved: true,
  amountCents: 200,
  chore: CHORE_DISHES,
  user: { id: 99, uuid: 'user-uuid-99', name: 'Sibling', createdAt: '2026-01-01T00:00:00Z' },
  notes: [],
  adminNotes: [],
};

const BADGE_FIRST_CHORE: UserBadge = {
  id: 1,
  userId: 20,
  badgeType: 'first_chore',
  earnedAt: '2026-08-01T00:00:00Z',
};

function baseMocks(): MockedResponse[] {
  return [
    {
      request: { query: GET_USER_CHORES, variables: { userId: 20 } },
      result: { data: { listChores: [CHORE_DISHES] } },
    },
    {
      request: {
        query: GET_WEEKLY_CHORES,
        variables: { userId: 20, weekStartDate: WEEK_START },
      },
      result: { data: { getWeeklyChoreCompletions: [] } },
    },
    {
      request: { query: GET_ALL_WEEKLY_COMPLETIONS, variables: { weekStartDate: WEEK_START } },
      result: { data: { getAllWeeklyCompletions: [OTHER_USER_COMPLETION] } },
    },
    {
      request: { query: GET_USER_BADGES, variables: { userId: 20 } },
      result: { data: { userBadges: [BADGE_FIRST_CHORE] } },
    },
    {
      request: { query: LIST_BONUS_CHORES, variables: { date: WEEK_START } },
      result: { data: { listBonusChores: [] } },
    },
  ];
}

function renderComponent() {
  return render(
    <MockedProvider mocks={baseMocks()}>
      <WeeklyChoreView user={USER_KID} />
    </MockedProvider>,
  );
}

async function waitForLoaded() {
  await screen.findByText("Kid's Chores");
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Only Date is faked; setTimeout/rAF stay real so userEvent/waitFor behave normally.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-05T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('WeeklyChoreView desktop (viewport >= 600px)', () => {
  beforeEach(() => setViewportWidth(1024));

  it('renders the desktop grid: a table with one date column header per day, plus the chore', async () => {
    renderComponent();
    await waitForLoaded();

    expect(screen.getByRole('table')).toBeInTheDocument();
    // 1 "Chore" header + 7 date columns.
    expect(screen.getAllByRole('columnheader')).toHaveLength(8);
    expect(screen.getByText('Wash dishes')).toBeInTheDocument();
    // Desktop-only week-range line (suppressed on mobile).
    expect(screen.getByText(/Week of/)).toBeInTheDocument();
  });

  it('renders the badge chips exactly once', async () => {
    renderComponent();
    await waitForLoaded();

    // Badges load via their own independent query (useUserBadges), not gated
    // behind the chores-loading check `waitForLoaded` waits on -- findBy* polls
    // until it resolves, rather than racing it.
    // The chip's text content is "🌟 First Chore!" (emoji + label in one span).
    await screen.findByText(/First Chore!/);
    expect(screen.getAllByText(/First Chore!/)).toHaveLength(1);
  });

  it('shows the "completed by someone else" indicator for a chore completed by another user', async () => {
    renderComponent();
    await waitForLoaded();

    const marks = await screen.findAllByText('✓');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveClass('bg-gray-500');
  });

  // Without `flex-wrap` the week navigator had nowhere to go once the name and
  // badges filled the row, so it overflowed and was clipped off the right edge
  // of the kiosk screen. `ml-auto` keeps it in the same top-right corner
  // whether it sits beside the badges or on the line below them. jsdom does no
  // layout, so the classes that produce the wrap are what we can pin.
  it('lets the week navigator wrap to its own row, still right-aligned', async () => {
    renderComponent();
    await waitForLoaded();

    const navigator = screen.getByRole('button', { name: /Previous/ }).closest('div');
    const navigatorSlot = navigator?.parentElement;
    expect(navigatorSlot).toHaveClass('ml-auto');

    const header = navigatorSlot?.parentElement;
    expect(header).toHaveClass('flex', 'flex-wrap');
  });
});

describe('WeeklyChoreView mobile (viewport < 600px)', () => {
  beforeEach(() => setViewportWidth(400));

  it('renders the card list with the mobile day navigator, not the desktop grid', async () => {
    renderComponent();
    await waitForLoaded();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // DayNavigator's "N of 7" position indicator is mobile-only.
    expect(screen.getByText('1 of 7')).toBeInTheDocument();
    expect(screen.getByText('Wash dishes')).toBeInTheDocument();
    expect(screen.queryByText(/Week of/)).not.toBeInTheDocument();
  });

  it('renders the badge chips exactly once', async () => {
    renderComponent();
    await waitForLoaded();

    // Badges load via their own independent query (useUserBadges), not gated
    // behind the chores-loading check `waitForLoaded` waits on -- findBy* polls
    // until it resolves, rather than racing it.
    // The chip's text content is "🌟 First Chore!" (emoji + label in one span).
    await screen.findByText(/First Chore!/);
    expect(screen.getAllByText(/First Chore!/)).toHaveLength(1);
  });

  it('shows the "completed by someone else" indicator for a chore completed by another user', async () => {
    renderComponent();
    await waitForLoaded();

    const marks = await screen.findAllByText('✓');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveClass('bg-gray-500');
  });
});

describe('WeeklyChoreView viewport changes', () => {
  it('switches from the desktop grid to the mobile card list on a live window resize', async () => {
    setViewportWidth(1024);
    renderComponent();
    await waitForLoaded();

    expect(screen.getByRole('table')).toBeInTheDocument();

    setViewportWidth(400);

    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
    expect(screen.getByText('1 of 7')).toBeInTheDocument();
  });
});
