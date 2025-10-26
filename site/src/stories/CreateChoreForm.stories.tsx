import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import CreateChoreForm from 'components/CreateChoreForm';
import { User, Chore, PaymentType } from 'types/chore';

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
    name: 'Charlie Rodriguez-Smith',
    createdAt: '2023-01-03T00:00:00Z',
  },
];

const manyUsers: User[] = [
  ...mockUsers,
  {
    id: 4,
    uuid: 'user-4',
    name: 'Diana',
    createdAt: '2023-01-04T00:00:00Z',
  },
  {
    id: 5,
    uuid: 'user-5',
    name: 'Edward',
    createdAt: '2023-01-05T00:00:00Z',
  },
  {
    id: 6,
    uuid: 'user-6',
    name: 'Fiona',
    createdAt: '2023-01-06T00:00:00Z',
  },
];

const existingChore: Chore = {
  id: 1,
  uuid: 'chore-1',
  name: 'Take out trash',
  description: 'Take the trash bins to the curb every Tuesday and Friday',
  amountCents: 500,
  paymentType: PaymentType.Daily,
  requiredDays: 36, // Tuesday (4) + Friday (32) = 36
  active: true,
  createdAt: '2023-01-01T00:00:00Z',
  createdByAdminId: 1,
  assignedUsers: [mockUsers[0], mockUsers[1]],
};

const weeklyChore: Chore = {
  id: 2,
  uuid: 'chore-2',
  name: 'Clean entire house',
  description: 'Deep clean all rooms including bathrooms, kitchen, and bedrooms',
  amountCents: 5000,
  paymentType: PaymentType.Weekly,
  requiredDays: 127, // All days
  active: true,
  createdAt: '2023-01-05T00:00:00Z',
  createdByAdminId: 1,
  assignedUsers: mockUsers,
};

const meta = {
  title: 'Components/CreateChoreForm',
  component: CreateChoreForm,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light',
    },
  },
  tags: ['autodocs'],
  args: {
    adminId: 1,
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof CreateChoreForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateNew: Story = {
  args: {
    users: mockUsers,
    loading: false,
  },
};

export const CreateNewWithManyUsers: Story = {
  args: {
    users: manyUsers,
    loading: false,
  },
};

export const EditingExisting: Story = {
  args: {
    users: mockUsers,
    loading: false,
    initialChore: existingChore,
  },
};

export const EditingWeeklyChore: Story = {
  args: {
    users: mockUsers,
    loading: false,
    initialChore: weeklyChore,
  },
};

export const LoadingState: Story = {
  args: {
    users: mockUsers,
    loading: true,
  },
};

export const NoUsers: Story = {
  args: {
    users: [],
    loading: false,
  },
};

export const SingleUser: Story = {
  args: {
    users: [mockUsers[0]],
    loading: false,
  },
};
