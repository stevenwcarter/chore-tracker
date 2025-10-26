import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { MockedProvider } from '@apollo/client/testing';
import { ChoreCompletionDetail } from 'components/ChoreCompletionDetail';
import { ChoreCompletion, PaymentType, AuthorType } from 'types/chore';

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

const baseCompletion: ChoreCompletion = {
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
  ...baseCompletion,
  id: 2,
  uuid: 'completion-2',
  approved: true,
  approvedAt: '2023-10-25T15:30:00Z',
  approvedByAdminId: 1,
};

const completionWithNotes: ChoreCompletion = {
  ...baseCompletion,
  id: 3,
  uuid: 'completion-3',
  notes: [
    {
      id: 1,
      choreCompletionId: 3,
      noteText: 'Great job! Trash was put out on time.',
      authorType: AuthorType.Admin,
      authorAdminId: 1,
      visibleToUser: true,
      createdAt: '2023-10-25T10:00:00Z',
    },
    {
      id: 2,
      choreCompletionId: 3,
      noteText: 'This note is only visible to admins - user needs reminder about lid placement',
      authorType: AuthorType.Admin,
      authorAdminId: 1,
      visibleToUser: false,
      createdAt: '2023-10-25T11:00:00Z',
    },
    {
      id: 3,
      choreCompletionId: 3,
      noteText: 'I put the bins out early this morning!',
      authorType: AuthorType.User,
      authorUserId: 1,
      visibleToUser: true,
      createdAt: '2023-10-25T08:00:00Z',
    },
  ],
};

const highValueCompletion: ChoreCompletion = {
  ...baseCompletion,
  id: 4,
  uuid: 'completion-4',
  amountCents: 2500,
  chore: {
    ...mockChore,
    name: 'Mow the entire lawn',
    description: 'Cut the grass in the front yard, back yard, and side areas',
    amountCents: 2500,
    paymentType: PaymentType.Weekly,
  },
};

const completionWithLongChoreName: ChoreCompletion = {
  ...baseCompletion,
  id: 5,
  uuid: 'completion-5',
  chore: {
    ...mockChore,
    name: 'Deep clean the entire house including all bathrooms, kitchen, living areas, and bedrooms',
    description: 'This is a comprehensive cleaning task that involves multiple rooms and detailed work',
  },
  user: {
    ...mockUser,
    name: 'Christopher Alexander Rodriguez-Smith',
  },
};

const meta = {
  title: 'Components/ChoreCompletionDetail',
  component: ChoreCompletionDetail,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  args: {
    onClose: fn(),
    onUpdate: fn(),
  },
} satisfies Meta<typeof ChoreCompletionDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PendingCompletion: Story = {
  args: {
    completion: baseCompletion,
    isAdmin: false,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={[]} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const PendingForAdmin: Story = {
  args: {
    completion: baseCompletion,
    isAdmin: true,
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={[]} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const ApprovedCompletion: Story = {
  args: {
    completion: approvedCompletion,
    isAdmin: true,
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={[]} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const WithNotes: Story = {
  args: {
    completion: completionWithNotes,
    isAdmin: true,
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={[]} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const WithNotesAsUser: Story = {
  args: {
    completion: completionWithNotes,
    isAdmin: false,
    userId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={[]} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const HighValueCompletion: Story = {
  args: {
    completion: highValueCompletion,
    isAdmin: true,
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={[]} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const LongNames: Story = {
  args: {
    completion: completionWithLongChoreName,
    isAdmin: false,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={[]} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};

export const MissingData: Story = {
  args: {
    completion: {
      ...baseCompletion,
      chore: undefined as any,
      user: undefined as any,
    },
    isAdmin: true,
    adminId: 1,
  },
  decorators: [
    (Story) => (
      <MockedProvider mocks={[]} addTypename={false}>
        <Story />
      </MockedProvider>
    ),
  ],
};
