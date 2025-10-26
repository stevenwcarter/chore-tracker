import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { CompletionCard } from './CompletionCard';
import { ChoreCompletion, PaymentType } from '../types/chore';

// Mock data for stories
const baseCompletion: ChoreCompletion = {
  id: 1,
  uuid: 'completion-1',
  choreId: 1,
  userId: 1,
  completedDate: '2023-10-25',
  approved: false,
  amountCents: 500, // $5.00
  createdAt: '2023-10-25T10:00:00Z',
  chore: {
    id: 1,
    uuid: 'chore-1',
    name: 'Take out trash',
    description: 'Take the trash bins to the curb',
    amountCents: 500,
    paymentType: PaymentType.Daily,
    requiredDays: 1,
    active: true,
    createdAt: '2023-01-01',
    createdByAdminId: 1,
  },
  user: {
    id: 1,
    uuid: 'user-1',
    name: 'Alice',
    createdAt: '2023-01-01',
  },
  notes: [],
  adminNotes: [],
};

const meta = {
  title: 'Components/CompletionCard',
  component: CompletionCard,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showActions: {
      control: 'boolean',
    },
  },
  args: {
    onViewDetails: fn(),
    onApprove: fn(),
    onReject: fn(),
  },
} satisfies Meta<typeof CompletionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PendingApproval: Story = {
  args: {
    completion: baseCompletion,
    showActions: false,
  },
};

export const PendingWithActions: Story = {
  args: {
    completion: baseCompletion,
    showActions: true,
  },
};

export const Approved: Story = {
  args: {
    completion: {
      ...baseCompletion,
      approved: true,
      approvedAt: '2023-10-25T15:30:00Z',
    },
    showActions: false,
  },
};

export const ApprovedWithActions: Story = {
  args: {
    completion: {
      ...baseCompletion,
      approved: true,
      approvedAt: '2023-10-25T15:30:00Z',
    },
    showActions: true,
  },
};

export const HighValue: Story = {
  args: {
    completion: {
      ...baseCompletion,
      amountCents: 2500, // $25.00
      chore: {
        ...baseCompletion.chore,
        name: 'Mow the lawn',
        amountCents: 2500,
      },
    },
    showActions: true,
  },
};

export const LongChoreName: Story = {
  args: {
    completion: {
      ...baseCompletion,
      chore: {
        ...baseCompletion.chore,
        name: 'This is a very long chore name that should wrap properly in the card layout',
      },
      user: {
        ...baseCompletion.user,
        name: 'Christopher Alexander',
      },
    },
    showActions: true,
  },
};

export const MissingData: Story = {
  args: {
    completion: {
      ...baseCompletion,
      chore: undefined as any,
      user: undefined as any,
    },
    showActions: true,
  },
};
