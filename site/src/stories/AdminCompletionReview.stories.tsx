import type { Meta, StoryObj } from '@storybook/react';
import { MockedProvider } from '@apollo/client/testing';
import { AdminCompletionReview } from 'components/AdminCompletionReview';
import { ChoreCompletion, PaymentType, AuthorType } from 'types/chore';
import { GET_ALL_WEEKLY_COMPLETIONS } from 'graphql/queries';

// Mock data for stories
const mockChore = {
  id: 1,
  uuid: 'chore-1',
  name: 'Take out trash',
  description: 'Take the trash bins to the curb',
  amountCents: 500,
  paymentType: PaymentType.Daily,
  requiredDays: 1,
  active: true,
  createdAt: '2023-01-01T00:00:00Z',
  createdByAdminId: 1,
};

const mockUser = {
  id: 1,
  uuid: 'user-1',
  name: 'Alice',
  createdAt: '2023-01-01T00:00:00Z',
};

const mockNote = {
  id: 1,
  choreCompletionId: 1,
  noteText: 'Great job! Trash was put out on time.',
  authorType: AuthorType.Admin,
  authorAdminId: 1,
  visibleToUser: true,
  createdAt: '2023-10-25T10:00:00Z',
};

const pendingCompletion: ChoreCompletion = {
  id: 1,
  uuid: 'completion-1',
  choreId: 1,
  userId: 1,
  completedDate: '2023-10-25',
  approved: false,
  amountCents: 500,
  createdAt: '2023-10-25T10:00:00Z',
  chore: mockChore,
  user: mockUser,
  notes: [],
  adminNotes: [],
};

const approvedCompletion: ChoreCompletion = {
  id: 2,
  uuid: 'completion-2',
  choreId: 1,
  userId: 1,
  completedDate: '2023-10-24',
  approved: true,
  approvedAt: '2023-10-24T15:30:00Z',
  approvedByAdminId: 1,
  amountCents: 500,
  createdAt: '2023-10-24T10:00:00Z',
  chore: mockChore,
  user: mockUser,
  notes: [mockNote],
  adminNotes: [],
};

const completionWithNotes: ChoreCompletion = {
  id: 3,
  uuid: 'completion-3',
  choreId: 1,
  userId: 1,
  completedDate: '2023-10-23',
  approved: false,
  amountCents: 1000,
  createdAt: '2023-10-23T10:00:00Z',
  chore: { ...mockChore, name: 'Mow the lawn', amountCents: 1000 },
  user: mockUser,
  notes: [
    mockNote,
    {
      id: 2,
      choreCompletionId: 3,
      noteText: 'This note is only visible to admins',
      authorType: AuthorType.Admin,
      authorAdminId: 1,
      visibleToUser: false,
      createdAt: '2023-10-23T11:00:00Z',
    },
  ],
  adminNotes: [],
};

// Mock GraphQL responses
const mockWithCompletions = [
  {
    request: {
      query: GET_ALL_WEEKLY_COMPLETIONS,
      variables: {
        weekStartDate: expect.any(String),
      },
    },
    result: {
      data: {
        getAllWeeklyCompletions: [pendingCompletion, approvedCompletion, completionWithNotes],
      },
    },
  },
];

const mockEmpty = [
  {
    request: {
      query: GET_ALL_WEEKLY_COMPLETIONS,
      variables: {
        weekStartDate: expect.any(String),
      },
    },
    result: {
      data: {
        getAllWeeklyCompletions: [],
      },
    },
  },
];

const mockLoading = [
  {
    request: {
      query: GET_ALL_WEEKLY_COMPLETIONS,
      variables: {
        weekStartDate: expect.any(String),
      },
    },
    delay: 5000, // Simulate slow loading
    result: {
      data: {
        getAllWeeklyCompletions: [pendingCompletion],
      },
    },
  },
];

const mockError = [
  {
    request: {
      query: GET_ALL_WEEKLY_COMPLETIONS,
      variables: {
        weekStartDate: expect.any(String),
      },
    },
    error: new Error('Failed to load completions'),
  },
];

const meta = {
  title: 'Components/AdminCompletionReview',
  component: AdminCompletionReview,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AdminCompletionReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCompletions: Story = {
  args: {
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockWithCompletions} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const EmptyWeek: Story = {
  args: {
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockEmpty} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const LoadingState: Story = {
  args: {
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockLoading} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const ErrorState: Story = {
  args: {
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockError} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};
