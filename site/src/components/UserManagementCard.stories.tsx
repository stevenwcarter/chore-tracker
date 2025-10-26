import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import UserManagementCard from './UserManagementCard';
import { User } from '../types/chore';

// Mock data for stories
const userWithImage: User = {
  id: 1,
  uuid: 'user-1',
  name: 'Alice',
  imagePath: '/images/alice.jpg',
  createdAt: '2023-01-01T00:00:00Z',
};

const userWithoutImage: User = {
  id: 2,
  uuid: 'user-2',
  name: 'Bob',
  createdAt: '2023-01-02T00:00:00Z',
};

const userWithLongName: User = {
  id: 3,
  uuid: 'user-3',
  name: 'Christopher Alexander Rodriguez-Smith Jr.',
  createdAt: '2023-01-03T00:00:00Z',
};

const meta = {
  title: 'Components/UserManagementCard',
  component: UserManagementCard,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  args: {
    onImageUpload: fn(),
    onRemoveImage: fn(),
  },
} satisfies Meta<typeof UserManagementCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  args: {
    user: userWithImage,
  },
};

export const WithoutImage: Story = {
  args: {
    user: userWithoutImage,
  },
};

export const LongName: Story = {
  args: {
    user: userWithLongName,
  },
};

export const LongNameWithImage: Story = {
  args: {
    user: {
      ...userWithLongName,
      imagePath: '/images/christopher.jpg',
    },
  },
};