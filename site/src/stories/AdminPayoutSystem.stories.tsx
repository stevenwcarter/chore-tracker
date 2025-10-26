import type { Meta, StoryObj } from '@storybook/react';
import { MockedProvider } from '@apollo/client/testing';
import { AdminPayoutSystem } from 'components/AdminPayoutSystem';
import { UnpaidTotal } from 'types/chore';
import { GET_UNPAID_TOTALS } from 'graphql/queries';

// Mock data for stories
const mockUnpaidTotals: UnpaidTotal[] = [
  {
    user: {
      id: 1,
      uuid: 'user-1',
      name: 'Alice',
      createdAt: '2023-01-01T00:00:00Z',
    },
    amountCents: 1500, // $15.00
  },
  {
    user: {
      id: 2,
      uuid: 'user-2',
      name: 'Bob',
      createdAt: '2023-01-02T00:00:00Z',
    },
    amountCents: 2300, // $23.00
  },
  {
    user: {
      id: 3,
      uuid: 'user-3',
      name: 'Charlie',
      createdAt: '2023-01-03T00:00:00Z',
    },
    amountCents: 750, // $7.50
  },
];

const highValueUnpaidTotals: UnpaidTotal[] = [
  {
    user: {
      id: 1,
      uuid: 'user-1',
      name: 'Alice',
      createdAt: '2023-01-01T00:00:00Z',
    },
    amountCents: 15000, // $150.00
  },
  {
    user: {
      id: 2,
      uuid: 'user-2',
      name: 'Christopher Alexander',
      createdAt: '2023-01-02T00:00:00Z',
    },
    amountCents: 28375, // $283.75
  },
];

const singleUserUnpaidTotal: UnpaidTotal[] = [
  {
    user: {
      id: 1,
      uuid: 'user-1',
      name: 'Alice',
      createdAt: '2023-01-01T00:00:00Z',
    },
    amountCents: 500, // $5.00
  },
];

// Mock GraphQL responses
const mockWithData = [
  {
    request: {
      query: GET_UNPAID_TOTALS,
    },
    result: {
      data: {
        getUnpaidTotals: mockUnpaidTotals,
      },
    },
  },
];

const mockHighValue = [
  {
    request: {
      query: GET_UNPAID_TOTALS,
    },
    result: {
      data: {
        getUnpaidTotals: highValueUnpaidTotals,
      },
    },
  },
];

const mockSingleUser = [
  {
    request: {
      query: GET_UNPAID_TOTALS,
    },
    result: {
      data: {
        getUnpaidTotals: singleUserUnpaidTotal,
      },
    },
  },
];

const mockEmpty = [
  {
    request: {
      query: GET_UNPAID_TOTALS,
    },
    result: {
      data: {
        getUnpaidTotals: [],
      },
    },
  },
];

const mockLoading = [
  {
    request: {
      query: GET_UNPAID_TOTALS,
    },
    delay: 5000,
    result: {
      data: {
        getUnpaidTotals: mockUnpaidTotals,
      },
    },
  },
];

const mockError = [
  {
    request: {
      query: GET_UNPAID_TOTALS,
    },
    error: new Error('Failed to load unpaid totals'),
  },
];

const meta = {
  title: 'Components/AdminPayoutSystem',
  component: AdminPayoutSystem,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AdminPayoutSystem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithUnpaidAmounts: Story = {
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

export const HighValueAmounts: Story = {
  args: {
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockHighValue} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const SingleUser: Story = {
  args: {
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={mockSingleUser} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const NothingToPayout: Story = {
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
