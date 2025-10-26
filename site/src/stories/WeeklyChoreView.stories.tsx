import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { MockedProvider } from '@apollo/client/testing';
import { WeeklyChoreView } from 'components/WeeklyChoreView';
import { User, ChoreCompletion, PaymentType, AuthorType } from 'types/chore';
import { GET_ALL_WEEKLY_COMPLETIONS, GET_USER_CHORES, GET_WEEKLY_CHORES } from 'graphql/queries';

const testDate = new Date(Date.now() - 4 * 60 * 60 *1000).toISOString(); // 4 hours ago

const notes= [
      {
        id: 1,
        choreCompletionId: 1,
        authorType: AuthorType.User,
        noteText: 'Completed on time!',
        visibleToUser: true,
        createdAt: testDate, // 4 hours ago
      }
    ];
    const adminNotes = [
      {
        id: 2,
        choreCompletionId: 1,
        authorType: AuthorType.User,
        noteText: 'Completed on time! (admin only)',
        visibleToUser: false,
        createdAt: testDate, // 4 hours ago
      }
    ];
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

// Helper function to get the Sunday of the current week (matching dateUtils.ts logic)
const getCurrentWeekStart = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day; // Subtract days since Sunday
  const weekStart = new Date(today);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

// Helper function to format date for GraphQL (matching dateUtils.ts)
const formatDateForGraphQL = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Create a date for current week (using Sunday as start, matching dateUtils.ts)
const currentWeekStart = getCurrentWeekStart();
const weekStartDate = formatDateForGraphQL(currentWeekStart);

// Update completion dates to be in the current week
const getDateInCurrentWeek = (dayOffset: number): string => {
  const date = new Date(currentWeekStart);
  date.setDate(currentWeekStart.getDate() + dayOffset);
  return formatDateForGraphQL(date);
};

// Mock completions with current week dates
const mockCompletions: ChoreCompletion[] = [
  {
    id: 1,
    uuid: 'completion-1',
    choreId: 1,
    userId: 1,
    completedDate: getDateInCurrentWeek(0), // Monday
    approved: true,
    approvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    amountCents: 500,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    chore: mockChores[0],
    user: mockUser,
    notes,
    adminNotes,
  },
  {
    id: 2,
    uuid: 'completion-2',
    choreId: 2,
    userId: 1,
    completedDate: getDateInCurrentWeek(0), // Monday
    approved: false,
    amountCents: 200,
    createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(), // 7 hours ago
    chore: mockChores[1],
    user: mockUser,
    notes,
    adminNotes,
  },
  {
    id: 3,
    uuid: 'completion-3',
    choreId: 2,
    userId: 1,
    completedDate: getDateInCurrentWeek(1), // Tuesday
    approved: true,
    approvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    amountCents: 200,
    createdAt: testDate, // 4 hours ago
    chore: mockChores[1],
    user: mockUser,
    notes,
    adminNotes,
  },
  {
    id: 4,
    uuid: 'completion-4',
    choreId: 3,
    userId: 1,
    completedDate: getDateInCurrentWeek(2), // Wednesday
    approved: false,
    amountCents: 1500,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    chore: mockChores[2],
    user: mockUser,
    notes,
    adminNotes,
  },
];

// Mock weekly completions with full chore and user data
const mockWeeklyCompletions = mockCompletions.map(completion => ({
  ...completion,
  chore: mockChores.find(chore => chore.id === completion.choreId),
  user: mockUser,
}));

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
    newData: () => ({
      data: {
        listChores: mockChores,
      },
    }),
  },
  {
    request: {
      query: GET_WEEKLY_CHORES,
      variables: {
        userId: 1,
        weekStartDate: weekStartDate,
      },
    },
    result: {
      data: {
        getWeeklyChoreCompletions: mockWeeklyCompletions,
      },
    },
    newData: () => ({
      data: {
        getWeeklyChoreCompletions: mockWeeklyCompletions,
      },
    }),
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
    newData: () => ({
      data: {
        getAllWeeklyCompletions: mockCompletions,
      },
    }),
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
    newData: () => ({
      data: {
        listChores: mockChores,
      },
    }),
  },
  {
    request: {
      query: GET_WEEKLY_CHORES,
      variables: {
        userId: 1,
        weekStartDate: weekStartDate,
      },
    },
    result: {
      data: {
        getWeeklyChoreCompletions: [],
      },
    },
    newData: () => ({
      data: {
        getWeeklyChoreCompletions: [],
      },
    }),
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
    newData: () => ({
      data: {
        getAllWeeklyCompletions: [],
      },
    }),
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
    newData: () => ({
      data: {
        listChores: [],
      },
    }),
  },
  {
    request: {
      query: GET_WEEKLY_CHORES,
      variables: {
        userId: 1,
        weekStartDate: weekStartDate,
      },
    },
    result: {
      data: {
        getWeeklyChoreCompletions: [],
      },
    },
    newData: () => ({
      data: {
        getWeeklyChoreCompletions: [],
      },
    }),
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
    newData: () => ({
      data: {
        getAllWeeklyCompletions: [],
      },
    }),
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
    newData: () => ({
      data: {
        listChores: mockChores,
      },
    }),
  },
  {
    request: {
      query: GET_WEEKLY_CHORES,
      variables: {
        userId: 1,
        weekStartDate: weekStartDate,
      },
    },
    delay: 5000,
    result: {
      data: {
        getWeeklyChoreCompletions: mockWeeklyCompletions,
      },
    },
    newData: () => ({
      data: {
        getWeeklyChoreCompletions: mockWeeklyCompletions,
      },
    }),
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
    newData: () => ({
      data: {
        getAllWeeklyCompletions: mockCompletions,
      },
    }),
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

// Fixed date story for consistent screenshots and testing
export const MobileView: Story = {
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
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Mobile layout showing day navigation and card-based chore display.',
      },
    },
  },
};
