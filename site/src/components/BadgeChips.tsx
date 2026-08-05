import React from 'react';
import { UserBadge, BADGE_DISPLAY } from '../types/chore';

interface BadgeChipsProps {
  badges: UserBadge[];
  wrap?: boolean;
}

/**
 * Achievement badge chips. `wrap` switches between the desktop layout (a
 * horizontally scrolling row alongside the week-range line) and the mobile
 * layout (a wrapping row, since there's no room beside the header).
 */
export const BadgeChips: React.FC<BadgeChipsProps> = ({ badges, wrap = false }) => {
  if (badges.length === 0) return null;

  return (
    <div
      className={
        wrap ? 'flex flex-wrap gap-2 mb-4' : 'flex flex-row gap-2 overflow-x-auto pb-1 mt-2'
      }
    >
      {badges.map((badge) => {
        const display = BADGE_DISPLAY[badge.badgeType];
        if (!display) return null;
        return (
          <span
            key={badge.id}
            className={
              wrap
                ? 'flex items-center gap-1 px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full text-sm'
                : 'flex items-center gap-1 px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full text-sm whitespace-nowrap'
            }
          >
            {display.emoji} {display.label}
          </span>
        );
      })}
    </div>
  );
};

export default BadgeChips;
