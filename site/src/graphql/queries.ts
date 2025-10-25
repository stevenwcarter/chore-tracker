import { gql } from '@apollo/client';

// User queries
export const GET_ALL_USERS = gql`
  query GetAllUsers {
    listUsers {
      id
      uuid
      name
      imagePath
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
      id
      uuid
      name
      description
      paymentType
      amountCents
      requiredDays
      active
      createdAt
    }
  }
`;

export const GET_WEEKLY_CHORES = gql`
  query GetWeeklyChores($userId: Int!, $weekStartDate: Date!) {
    getWeeklyChoreCompletions(userId: $userId, weekStartDate: $weekStartDate) {
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
    }
  }
`;

export const GET_ALL_WEEKLY_COMPLETIONS = gql`
  query GetAllWeeklyCompletions($weekStartDate: Date!) {
    getAllWeeklyCompletions(weekStartDate: $weekStartDate) {
      id
      uuid
      userId
      choreId
      completedDate
      approved
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
    }
  }
`;

// Admin queries
export const GET_ALL_CHORES = gql`
  query GetAllChores {
    listChores {
      id
      uuid
      name
      description
      amountCents
      paymentType
      requiredDays
      active
      createdAt
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
  mutation ApproveChoreCompletion($completionUuid: String!, $adminId: Int!) {
    approveChoreCompletion(completionUuid: $completionUuid, adminId: $adminId) {
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
      id
      uuid
      noteText
      authorType
      visibleToUser
      createdAt
    }
  }
`;

// Admin mutations
export const CREATE_USER = gql`
  mutation CreateUser($user: UserInput!) {
    createUser(user: $user) {
      id
      uuid
      name
      imagePath
      createdAt
    }
  }
`;

export const CREATE_CHORE = gql`
  mutation CreateChore($chore: ChoreInput!) {
    createChore(chore: $chore) {
      id
      uuid
      name
      description
      amountCents
      paymentType
      requiredDays
      active
      createdAt
    }
  }
`;

export const UPDATE_CHORE = gql`
  mutation UpdateChore($chore: ChoreInput!) {
    updateChore(chore: $chore) {
      id
      uuid
      name
      description
      amountCents
      paymentType
      requiredDays
      active
      createdAt
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
