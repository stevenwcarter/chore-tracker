export interface User {
  id: number;
  uuid: string;
  name: string;
  imagePath?: string;
  createdAt: string;
}

export interface Admin {
  id: number;
  oidcSubject: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Chore {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  amountCents: number;
  paymentType: PaymentType;
  /**
   * Bitmask of the weekdays this chore is scheduled for, using the backend layout:
   * 1 = Mon, 2 = Tue, 4 = Wed, 8 = Thu, 16 = Fri, 32 = Sat, 64 = Sun. 0 means no
   * scheduled days. For weekly chores the server divides `amountCents` by the number
   * of set bits to arrive at the per-completion payout.
   */
  requiredDays: number;
  active?: boolean;
  createdAt: string;
  createdByAdminId: number;
  assignedUsers?: User[];
  bonusDate?: string | null; // ISO 8601 date, null for regular chores
  maxClaims?: number | null; // null for unlimited
}

export interface ChoreCompletion {
  id: number;
  uuid: string;
  choreId: number;
  userId: number;
  completedDate: string;
  approved: boolean;
  approvedAt?: string;
  approvedByAdminId?: number;
  amountCents: number;
  paidOutAt?: string;
  createdAt?: string;
  updatedAt?: string;
  chore: Chore;
  user: User;
  notes: ChoreCompletionNote[];
  adminNotes: ChoreCompletionNote[];
}

export interface ChoreCompletionNote {
  id: number;
  choreCompletionId: number;
  noteText: string;
  authorType: AuthorType;
  authorUserId?: number;
  authorAdminId?: number;
  visibleToUser: boolean;
  createdAt: string;
}

export interface WeeklyChoreData {
  chore: Chore;
  completions: ChoreCompletion[];
}

export interface UnpaidTotal {
  user: User;
  amountCents: number;
}

/**
 * How a chore's `amountCents` turns into money for the kid.
 *
 * `Daily` pays the full `amountCents` for every completion. `Weekly` splits `amountCents`
 * across the days set in `requiredDays`, so a weekly chore's `amountCents` shown in the UI
 * is the whole-week total, not what a single completion is worth.
 */
export enum PaymentType {
  Daily = 'DAILY',
  Weekly = 'WEEKLY',
}

export enum AuthorType {
  User = 'USER',
  Admin = 'ADMIN',
}

// Input types for mutations
export interface UserInput {
  name: string;
  imagePath?: string;
}

// Backend-compatible input type for GraphQL
export interface ChoreInput {
  uuid?: string;
  name: string;
  description?: string;
  paymentType: PaymentType;
  amountCents: number;
  requiredDays: number;
  active?: boolean;
  createdByAdminId: number;
}

// Frontend form type (what the UI uses)
export interface ChoreFormInput {
  title: string;
  description?: string;
  paymentType: PaymentType;
  amountCents: number;
  daysOfWeek: number[];
  createdByAdminId: number;
}

export interface ChoreCompletionInput {
  choreId: number;
  userId: number;
  completedDate: string; // Required - format as YYYY-MM-DD
}

export interface ChoreCompletionNoteInput {
  choreCompletionId: number;
  noteText: string;
  authorType: AuthorType;
  authorUserId?: number;
  authorAdminId?: number;
  visibleToUser: boolean;
}

export interface WeekDateRange {
  start: Date;
  end: Date;
  dates: Date[];
}

export interface UserBadge {
  id: number;
  userId: number;
  badgeType: string;
  earnedAt: string; // ISO timestamp string
}

export const BADGE_DISPLAY: Record<string, { emoji: string; label: string }> = {
  first_chore: { emoji: '🌟', label: 'First Chore!' },
  ten_dollars_earned: { emoji: '💰', label: 'Earned $10' },
  fifty_dollars_earned: { emoji: '🏆', label: 'Earned $50' },
  perfect_week: { emoji: '✨', label: 'Perfect Week' },
  five_day_streak: { emoji: '🔥', label: '5-Day Streak' },
};
