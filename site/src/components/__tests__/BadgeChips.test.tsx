import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import BadgeChips from '../BadgeChips';
import { UserBadge } from 'types/chore';

const badges: UserBadge[] = [
  { id: 1, userId: 1, badgeType: 'first_chore', earnedAt: '2026-01-01T00:00:00Z' },
  { id: 2, userId: 1, badgeType: 'ten_dollars_earned', earnedAt: '2026-01-02T00:00:00Z' },
  { id: 3, userId: 1, badgeType: 'five_day_streak', earnedAt: '2026-01-03T00:00:00Z' },
] as UserBadge[];

describe('BadgeChips', () => {
  it('renders nothing when there are no badges', () => {
    const { container } = render(<BadgeChips badges={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one chip per badge', () => {
    render(<BadgeChips badges={badges} />);
    expect(screen.getByText(/First Chore!/)).toBeInTheDocument();
    expect(screen.getAllByText(/./, { selector: 'span' })).toHaveLength(badges.length);
  });

  // The chips used to be a horizontally scrolling strip of nowrap chips on
  // desktop. That strip held its full width, which is what pushed the week
  // navigator off the right edge of the kiosk screen - and it forced a sideways
  // swipe to read badges past the fold. Both are regressions worth catching.
  it('wraps onto additional lines rather than scrolling sideways', () => {
    const { container } = render(<BadgeChips badges={badges} />);

    const row = container.firstElementChild;
    expect(row).toHaveClass('flex', 'flex-wrap');
    expect(row?.className).not.toMatch(/overflow-x/);

    for (const chip of screen.getAllByText(/./, { selector: 'span' })) {
      expect(chip.className).not.toMatch(/whitespace-nowrap/);
    }
  });
});
