import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { MockedProvider } from '@apollo/client/testing';
import { WeeklyChoreView } from './WeeklyChoreView';
import { User, ChoreCompletion, PaymentType } from '../types/chore';
import { GET_ALL_WEEKLY_COMPLETIONS, GET_USER_CHORES } from '../graphql/queries';

// Mock data for stories
const mockUser: User = {
  id: 1,
  uuid: 'user-1',
  name: 'Alice',
  imagePath: '/images/alice.jpg',
  createdAt: '2023-01-01T00:00:00Z',
};

const mockChores = [
  {
    id: 1,
    uuid: 'chore-1',
    name: 'Take out trash',
    description: 'Take the trash bins to the curb',
    amountCents: 500,
    paymentType: PaymentType.Daily,
    requiredDays: 2,
    active: true,
    createdAt: '2023-01-01T00:00:00Z',
    createdByAdminId: 1,
  },
  {
    id: 2,
    uuid: 'chore-2',
    name: 'Feed pets',
    description: 'Give food and water to the cats and dogs',
    amountCents: 200,
    paymentType: PaymentType.Daily,
    requiredDays: 7,
    active: true,
    createdAt: '2023-01-05T00:00:00Z',
    createdByAdminId: 1,
  },
  {
    id: 3,
    uuid: 'chore-3',
    name: 'Vacuum living room',
    description: 'Vacuum the main living areas',
    amountCents: 1500,
    paymentType: PaymentType.Weekly,
    requiredDays: 2,
    active: true,
    createdAt: '2023-01-10T00:00:00Z',
    createdByAdminId: 1,
  },
];

const mockCompletions: ChoreCompletion[] = [
  {
    id: 1,
    uuid: 'completion-1',
    choreId: 1,
    userId: 1,
    completedDate: '2023-10-23',
    approved: true,
    approvedAt: '2023-10-23T15:00:00Z',
    amountCents: 500,
    createdAt: '2023-10-23T10:00:00Z',
    chore: mockChores[0],
    user: mockUser,
    notes: [],
    adminNotes: [],
  },
  {
    id: 2,
    uuid: 'completion-2',
    choreId: 2,
    userId: 1,
    completedDate: '2023-10-23',
    approved: false,
    amountCents: 200,
    createdAt: '2023-10-23T08:00:00Z',
    chore: mockChores[1],
    user: mockUser,
    notes: [],
    adminNotes: [],
  },
  {
    id: 3,
    uuid: 'completion-3',
    choreId: 2,
    userId: 1,
    completedDate: '2023-10-24',
    approved: true,
    approvedAt: '2023-10-24T16:00:00Z',
    amountCents: 200,
    createdAt: '2023-10-24T09:00:00Z',
    chore: mockChores[1],
    user: mockUser,
    notes: [],
    adminNotes: [],
  },
  {
    id: 4,
    uuid: 'completion-4',
    choreId: 3,
    userId: 1,
    completedDate: '2023-10-25',
    approved: false,
    amountCents: 1500,
    createdAt: '2023-10-25T14:00:00Z',
    chore: mockChores[2],
    user: mockUser,
    notes: [],
    adminNotes: [],
  },
];

// Create a date for current week (using Monday as start)
const currentDate = new Date('2023-10-23'); // Monday
const weekStartDate = currentDate.toISOString().split('T')[0];

// Mock GraphQL responses
const mockWithData = [
  {
    request: {
      query: GET_USER_CHORES,
      variables: {
        userId: 1,
      },
    },
    result: {
      data: {
        listChores: mockChores,
      },
    },
  },
  {
    request: {
      query: GET_ALL_WEEKLY_COMPLETIONS,
      variables: {
        weekStartDate: weekStartDate,
      },
    },
    result: {
      data: {
        getAllWeeklyCompletions: mockCompletions,
      },
    },
  },
];

const mockNoCompletions = [
  {
    request: {
      query: GET_USER_CHORES,
      variables: {
        userId: 1,
      },
    },
    result: {
      data: {
        listChores: mockChores,
      },
    },
  },
  {
    request: {
      query: GET_ALL_WEEKLY_COMPLETIONS,
      variables: {
        weekStartDate: weekStartDate,
      },
    },
    result: {
      data: {
        getAllWeeklyCompletions: [],
      },
    },
  },
];

const mockNoChores = [
  {
    request: {
      query: GET_USER_CHORES,
      variables: {
        userId: 1,
      },
    },
    result: {
      data: {
        listChores: [],
      },
    },
  },
  {
    request: {
      query: GET_ALL_WEEKLY_COMPLETIONS,
      variables: {
        weekStartDate: weekStartDate,
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
      query: GET_USER_CHORES,
      variables: {
        userId: 1,
      },
    },
    delay: 5000,
    result: {
      data: {
        listChores: mockChores,
      },
    },
  },
  {
    request: {
      query: GET_ALL_WEEKLY_COMPLETIONS,
      variables: {
        weekStartDate: weekStartDate,
      },
    },
    delay: 5000,
    result: {
      data: {
        getAllWeeklyCompletions: mockCompletions,
      },
    },
  },
];

const meta = {
  title: 'Components/WeeklyChoreView',
  component: WeeklyChoreView,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  args: {
    onBack: fn(),
  },
} satisfies Meta<typeof WeeklyChoreView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AsUser: Story = {
  args: {
    user: mockUser,
    isAdmin: false,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockWithData} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const AsAdmin: Story = {
  args: {
    user: mockUser,
    isAdmin: true,
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockWithData} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const NoCompletions: Story = {
  args: {
    user: mockUser,
    isAdmin: false,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockNoCompletions} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const NoChoresAssigned: Story = {
  args: {
    user: mockUser,
    isAdmin: false,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockNoChores} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const LoadingState: Story = {
  args: {
    user: mockUser,
    isAdmin: false,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockLoading} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const LongUserName: Story = {
  args: {
    user: {
      ...mockUser,
      name: 'Christopher Alexander Rodriguez-Smith Jr.',
    },
    isAdmin: true,
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockWithData} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};