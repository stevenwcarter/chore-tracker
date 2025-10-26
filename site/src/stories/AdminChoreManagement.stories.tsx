import type { Meta, StoryObj } from '@storybook/react';
import { MockedProvider } from '@apollo/client/testing';
import { AdminChoreManagement } from 'components/AdminChoreManagement';
import { Chore, User, PaymentType } from 'types/chore';
import { GET_ALL_CHORES, GET_ALL_USERS } from 'graphql/queries';

// Mock data for stories
const mockUsers: User[] = [
  {
    id: 1,
    uuid: 'user-1',
    name: 'Alice',
    imagePath: '/images/alice.jpg',
    createdAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 2,
    uuid: 'user-2',
    name: 'Bob',
    imagePath: '/images/bob.jpg',
    createdAt: '2023-01-02T00:00:00Z',
  },
  {
    id: 3,
    uuid: 'user-3',
    name: 'Charlie',
    createdAt: '2023-01-03T00:00:00Z',
  },
];

const mockChores: Chore[] = [
  {
    id: 1,
    uuid: 'chore-1',
    name: 'Take out trash',
    description: 'Take the trash bins to the curb every Tuesday and Friday',
    amountCents: 500,
    paymentType: PaymentType.Daily,
    requiredDays: 2,
    active: true,
    createdAt: '2023-01-01T00:00:00Z',
    createdByAdminId: 1,
    assignedUsers: [mockUsers[0], mockUsers[1]],
  },
  {
    id: 2,
    uuid: 'chore-2',
    name: 'Mow the lawn',
    description: 'Cut the grass in the front and back yard',
    amountCents: 2500,
    paymentType: PaymentType.Weekly,
    requiredDays: 1,
    active: true,
    createdAt: '2023-01-05T00:00:00Z',
    createdByAdminId: 1,
    assignedUsers: [mockUsers[1]],
  },
  {
    id: 3,
    uuid: 'chore-3',
    name: 'Clean dishes',
    description: 'Wash, dry, and put away all dishes',
    amountCents: 300,
    paymentType: PaymentType.Daily,
    requiredDays: 7,
    active: true,
    createdAt: '2023-01-10T00:00:00Z',
    createdByAdminId: 1,
    assignedUsers: mockUsers,
  },
  {
    id: 4,
    uuid: 'chore-4',
    name: 'Vacuum upstairs',
    description: 'Vacuum all the upstairs rooms',
    amountCents: 1000,
    paymentType: PaymentType.Weekly,
    requiredDays: 3,
    active: false,
    createdAt: '2023-01-15T00:00:00Z',
    createdByAdminId: 1,
    assignedUsers: [],
  },
];

// Mock GraphQL responses
const mockWithData = [
  {
    request: {
      query: GET_ALL_CHORES,
    },
    result: {
      data: {
        listChores: mockChores,
      },
    },
  },
  {
    request: {
      query: GET_ALL_USERS,
    },
    result: {
      data: {
        listUsers: mockUsers,
      },
    },
  },
];

const mockEmpty = [
  {
    request: {
      query: GET_ALL_CHORES,
    },
    result: {
      data: {
        listChores: [],
      },
    },
  },
  {
    request: {
      query: GET_ALL_USERS,
    },
    result: {
      data: {
        listUsers: [],
      },
    },
  },
];

const mockLoading = [
  {
    request: {
      query: GET_ALL_CHORES,
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
      query: GET_ALL_USERS,
    },
    delay: 5000,
    result: {
      data: {
        listUsers: mockUsers,
      },
    },
  },
];

const mockError = [
  {
    request: {
      query: GET_ALL_CHORES,
    },
    error: new Error('Failed to load chores'),
  },
  {
    request: {
      query: GET_ALL_USERS,
    },
    error: new Error('Failed to load users'),
  },
];

const meta = {
  title: 'Components/AdminChoreManagement',
  component: AdminChoreManagement,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AdminChoreManagement>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithData: Story = {
  args: {
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

export const EmptyState: Story = {
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
