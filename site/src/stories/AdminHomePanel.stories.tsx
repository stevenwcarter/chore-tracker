import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminHomePanel } from 'components/AdminHomePanel';
import { Admin } from 'types/chore';

// Mock data for stories
const mockAdmin: Admin = {
  id: 1,
  oidcSubject: 'admin-1',
  name: 'Sarah Johnson',
  email: 'sarah@example.com',
  createdAt: '2023-01-01T00:00:00Z',
};

const longNameAdmin: Admin = {
  id: 2,
  oidcSubject: 'admin-2',
  name: 'Christopher Alexander Rodriguez',
  email: 'christopher.alexander.rodriguez@verylongdomain.example.com',
  createdAt: '2023-01-01T00:00:00Z',
};

const meta = {
  title: 'Components/AdminHomePanel',
  component: AdminHomePanel,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof AdminHomePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    currentAdmin: mockAdmin,
  },
};

export const LongName: Story = {
  args: {
    currentAdmin: longNameAdmin,
  },
};

export const MinimalName: Story = {
  args: {
    currentAdmin: {
      ...mockAdmin,
      name: 'Jo',
    },
  },
};
