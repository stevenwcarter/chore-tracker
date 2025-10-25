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
  id: number; // Keep as string for now
  uuid: string;
  title: string;
  name?: string; // Backend field
  description?: string;
  amountCents: number;
  paymentType: PaymentType;
  daysOfWeek: number[];
  requiredDays?: number; // Backend field
  active?: boolean; // Backend field
  createdAt: string;
  createdByAdminId: number; // Keep as string for now
  assignedUsers?: User[];
}

export interface ChoreCompletion {
  id: number;
  uuid: string;
  choreId: number;
  userId: number;
  completedAt: string;
  completedDate?: string;
  approved?: boolean;
  approvedAt?: string;
  approvedByAdminId?: number; // Keep as string for now
  amountCents: number;
  paidOutAt?: string;
  createdAt: string;
  updatedAt: string;
  chore?: Chore;
  user?: User;
  notes?: ChoreCompletionNote[];
}

export interface ChoreCompletionNote {
  id: number;
  choreCompletionId: number;
  note: string;
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
  note: string;
  authorType: AuthorType;
  authorUserId?: number;
  authorAdminId?: number;
  visibleToUser: boolean;
}

// Helper types for UI
export interface DayOfWeek {
  index: number;
  name: string;
  short: string;
}

export const DAYS_OF_WEEK: DayOfWeek[] = [
  { index: 0, name: 'Sunday', short: 'Sun' },
  { index: 1, name: 'Monday', short: 'Mon' },
  { index: 2, name: 'Tuesday', short: 'Tue' },
  { index: 3, name: 'Wednesday', short: 'Wed' },
  { index: 4, name: 'Thursday', short: 'Thu' },
  { index: 5, name: 'Friday', short: 'Fri' },
  { index: 6, name: 'Saturday', short: 'Sat' },
];

export interface WeekDateRange {
  start: Date;
  end: Date;
  dates: Date[];
}
