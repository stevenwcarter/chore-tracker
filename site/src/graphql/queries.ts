import { gql } from '@apollo/client';

/**
 * Shared field lists, DRYing out selection sets that were duplicated verbatim
 * across the queries below.
 *
 * These are plain strings interpolated into each query's `gql` template -
 * deliberately NOT real GraphQL `fragment` / `...spread` syntax. A real
 * fragment spread needs `__typename` present on every mocked object for
 * Apollo's `InMemoryCache` to resolve it when normalizing a write; none of
 * this app's test fixtures currently supply `__typename`, so switching to
 * real fragments silently dropped every field reached only through a spread
 * in several existing tests (verified by reproducing it outside React,
 * directly against `InMemoryCache`). Plain string interpolation parses to the
 * exact same `OperationDefinition` - no fragment definitions at all - so it
 * shares the field list at the source level without changing the query shape
 * Apollo executes.
 */
const USER_SUMMARY_FIELDS = `
  id
  uuid
  name
  imagePath
`;

const CHORE_SUMMARY_FIELDS = `
  id
  uuid
  name
  description
  amountCents
  paymentType
  requiredDays
  active
  createdAt
`;

const NOTE_FIELDS = `
  id
  uuid
  noteText
  authorType
  visibleToUser
  createdAt
`;

const COMPLETION_FIELDS = `
  id
  uuid
  userId
  choreId
  completedDate
  approved
  amountCents
  paidOutAt
  approvedAt
  approvedByAdminId
  createdAt
  updatedAt
`;

// User queries
export const GET_ALL_USERS = gql`
  query GetAllUsers {
    listUsers {
      ${USER_SUMMARY_FIELDS}
      createdAt
    }
  }
`;

export const GET_USER = gql`
  query GetUser($userUuid: String!) {
    getUser(userUuid: $userUuid) {
      id
      uuid
      name
      imagePath
      createdAt
    }
  }
`;

// Chore queries
export const GET_USER_CHORES = gql`
  query GetUserChores($userId: Int!) {
    listChores(userId: $userId, activeOnly: true) {
      ${CHORE_SUMMARY_FIELDS}
      availabilityWindow {
        startMonth
        startDay
        endMonth
        endDay
      }
    }
  }
`;

export const GET_WEEKLY_CHORES = gql`
  query GetWeeklyChores($userId: Int!, $weekStartDate: LocalDate!) {
    getWeeklyChoreCompletions(userId: $userId, weekStartDate: $weekStartDate) {
      ${COMPLETION_FIELDS}
      chore {
        id
        uuid
        name
        description
        amountCents
        paymentType
        requiredDays
      }
      user {
        id
        uuid
        name
      }
      notes {
        ${NOTE_FIELDS}
      }
    }
  }
`;

export const GET_ALL_WEEKLY_COMPLETIONS = gql`
  query GetAllWeeklyCompletions($weekStartDate: LocalDate!) {
    getAllWeeklyCompletions(weekStartDate: $weekStartDate) {
      id
      uuid
      userId
      choreId
      completedDate
      approved
      approvedAt
      amountCents
      chore {
        id
        uuid
        name
      }
      user {
        id
        uuid
        name
      }
      notes {
        id
        uuid
        noteText
        authorType
        visibleToUser
        createdAt
      }
    }
  }
`;

// Admin queries
export const GET_ALL_CHORES = gql`
  query GetAllChores {
    listChores {
      ${CHORE_SUMMARY_FIELDS}
      availabilityWindow {
        startMonth
        startDay
        endMonth
        endDay
      }
      assignedUsers {
        id
        uuid
        name
        imageId
        imagePath
      }
    }
  }
`;

export const GET_UNPAID_TOTALS = gql`
  query GetUnpaidTotals {
    getUnpaidTotals {
      user {
        id
        uuid
        name
      }
      amountCents
    }
  }
`;

// Chore completion mutations
export const CREATE_CHORE_COMPLETION = gql`
  mutation CreateChoreCompletion($completion: ChoreCompletionInput!) {
    createChoreCompletion(completion: $completion) {
      id
      uuid
      completedDate
      approved
      amountCents
    }
  }
`;

export const APPROVE_CHORE_COMPLETION = gql`
  mutation ApproveChoreCompletion($completionUuid: String!) {
    approveChoreCompletion(completionUuid: $completionUuid) {
      id
      uuid
      approved
      approvedAt
      approvedByAdminId
    }
  }
`;

export const DELETE_CHORE_COMPLETION = gql`
  mutation DeleteChoreCompletion($completionUuid: String!) {
    deleteChoreCompletion(completionUuid: $completionUuid)
  }
`;

export const ADD_CHORE_NOTE = gql`
  mutation AddChoreNote($note: ChoreCompletionNoteInput!) {
    createChoreCompletionNote(note: $note) {
      ${NOTE_FIELDS}
    }
  }
`;

// Admin mutations
export const CREATE_USER = gql`
  mutation CreateUser($user: UserInput!) {
    createUser(user: $user) {
      ${USER_SUMMARY_FIELDS}
      createdAt
    }
  }
`;

export const CREATE_CHORE = gql`
  mutation CreateChore($chore: ChoreInput!) {
    createChore(chore: $chore) {
      ${CHORE_SUMMARY_FIELDS}
    }
  }
`;

export const UPDATE_CHORE = gql`
  mutation UpdateChore($chore: ChoreInput!) {
    updateChore(chore: $chore) {
      ${CHORE_SUMMARY_FIELDS}
      availabilityWindow {
        startMonth
        startDay
        endMonth
        endDay
      }
    }
  }
`;

export const ASSIGN_CHORE_TO_USER = gql`
  mutation AssignChoreToUser($choreId: Int!, $userId: Int!) {
    assignUserToChore(choreId: $choreId, userId: $userId)
  }
`;
export const UNASSIGN_USER_FROM_CHORE = gql`
  mutation UnassignUserFromChore($choreId: Int!, $userId: Int!) {
    unassignUserFromChore(choreId: $choreId, userId: $userId)
  }
`;

export const MARK_COMPLETIONS_AS_PAID = gql`
  mutation MarkCompletionsAsPaid($userIds: [Int!]!) {
    markCompletionsAsPaid(userIds: $userIds)
  }
`;

export const LIST_BONUS_CHORES = gql`
  query ListBonusChores($date: LocalDate!) {
    listBonusChores(date: $date) {
      id
      uuid
      name
      description
      paymentType
      amountCents
      bonusDate
      maxClaims
    }
  }
`;

export const CREATE_BONUS_CHORE = gql`
  mutation CreateBonusChore($chore: ChoreInput!) {
    createBonusChore(chore: $chore) {
      id
      uuid
      name
      bonusDate
      maxClaims
    }
  }
`;

export const GET_USER_BADGES = gql`
  query GetUserBadges($userId: Int!) {
    userBadges(userId: $userId) {
      id
      userId
      badgeType
      earnedAt
    }
  }
`;
