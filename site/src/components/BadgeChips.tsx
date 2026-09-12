import React from 'react';
import { UserBadge, BADGE_DISPLAY } from '../types/chore';

interface BadgeChipsProps {
  badges: UserBadge[];
}

/**
 * Achievement badge chips, as a wrapping row.
 *
 * Desktop used to render these as a horizontally scrolling strip of
 * `whitespace-nowrap` chips. On the kiosk that meant a kid with several badges
 * had to swipe sideways to see them all, and the strip's full width was also
 * what shoved the week navigator off the right edge. Wrapping onto a second
 * line - what mobile always did - avoids both.
 */
export const BadgeChips: React.FC<BadgeChipsProps> = ({ badges }) => {
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2 mb-4">
      {badges.map((badge) => {
        const display = BADGE_DISPLAY[badge.badgeType];
        if (!display) return null;
        return (
          <span
            key={badge.id}
            className="flex items-center gap-1 px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full text-sm"
          >
            {display.emoji} {display.label}
          </span>
        );
      })}
    </div>
  );
};

export default BadgeChips;
