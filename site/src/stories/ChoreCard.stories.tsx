import { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ChoreCard } from 'components/ChoreCard';
import { Chore, PaymentType } from 'types/chore';

// Mock data for stories
const mockUsers = [
  { id: 1, uuid: 'user-1', name: 'Alice', createdAt: '2023-01-01' },
  { id: 2, uuid: 'user-2', name: 'Bob', createdAt: '2023-01-01' },
  { id: 3, uuid: 'user-3', name: 'Charlie', createdAt: '2023-01-01' },
];

const baseChore: Chore = {
  id: 1,
  uuid: 'chore-1',
  name: 'Take out trash',
  description: 'Take the trash bins to the curb every Tuesday night',
  amountCents: 500, // $5.00
  paymentType: PaymentType.Daily,
  requiredDays: 1,
  active: true,
  createdAt: '2023-01-01',
  createdByAdminId: 1,
  assignedUsers: [mockUsers[0], mockUsers[1]],
};

const meta = {
  title: 'Components/ChoreCard',
  component: ChoreCard,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1f2937' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  tags: ['autodocs'],
  args: {
    onManage: fn(),
    onEdit: fn(),
  },
} satisfies Meta<typeof ChoreCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    chore: baseChore,
  },
};

export const WeeklyPayment: Story = {
  args: {
    chore: {
      ...baseChore,
      name: 'Clean bedroom',
      description: 'Clean and organize bedroom every day of the week',
      paymentType: PaymentType.Weekly,
      amountCents: 1000, // $10.00
      requiredDays: 7,
    },
  },
};

export const HighValue: Story = {
  args: {
    chore: {
      ...baseChore,
      name: 'Mow the lawn',
      description: 'Mow the front and back yard, trim edges',
      amountCents: 2500, // $25.00
      requiredDays: 1,
    },
  },
};

export const NoDescription: Story = {
  args: {
    chore: {
      ...baseChore,
      description: undefined,
      name: 'Feed the cat',
    },
  },
};

export const Inactive: Story = {
  args: {
    chore: {
      ...baseChore,
      name: 'Seasonal chore',
      description: 'This chore is currently inactive',
      active: false,
    },
  },
};

export const NoAssignedUsers: Story = {
  args: {
    chore: {
      ...baseChore,
      name: 'New unassigned chore',
      description: 'This chore has not been assigned to anyone yet',
      assignedUsers: [],
    },
  },
};

export const ManyAssignedUsers: Story = {
  args: {
    chore: {
      ...baseChore,
      name: 'Team chore',
      description: 'This chore is assigned to multiple users',
      assignedUsers: mockUsers,
    },
  },
};

export const LongNames: Story = {
  args: {
    chore: {
      ...baseChore,
      name: 'This is a very long chore name that should wrap properly on mobile devices',
      description:
        'This is a very long description that contains a lot of details about what needs to be done for this particular chore. It should wrap nicely and remain readable.',
      assignedUsers: [
        {
          id: 4,
          uuid: 'user-4',
          name: 'Alexander Christopher Thompson',
          createdAt: '2023-01-01',
        },
        {
          id: 5,
          uuid: 'user-5',
          name: 'Isabella Francesca Rodriguez-Martinez',
          createdAt: '2023-01-01',
        },
      ],
    },
  },
};
