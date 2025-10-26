import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { User } from '../types/chore';

// Create a simple mock component that doesn't require GraphQL
interface UserSelectorMockProps {
  selectedUserId: number | null;
  onUserSelect: (user: User) => void;
  className?: string;
  users?: User[];
}

const UserSelectorMock = ({
  selectedUserId,
  onUserSelect,
  className = '',
  users,
}: UserSelectorMockProps) => {
  const mockUsers: User[] = users || [
    { id: 1, uuid: 'user-1', name: 'Alice', createdAt: '2023-01-01' },
    { id: 2, uuid: 'user-2', name: 'Bob', createdAt: '2023-01-01' },
    { id: 3, uuid: 'user-3', name: 'Charlie', createdAt: '2023-01-01' },
  ];

  return (
    <div
      className={`flex gap-4 justify-center items-center p-4 bg-gray-800 text-white rounded-lg shadow-md ${className}`}
    >
      <div className="flex gap-3">
        {mockUsers.map((user) => (
          <button
            key={user.id}
            onClick={() => onUserSelect(user)}
            className={`relative group transition-all duration-200 ${
              selectedUserId === user.id
                ? 'ring-4 ring-blue-500 ring-opacity-50 scale-105'
                : 'hover:scale-105 hover:shadow-lg'
            }`}
          >
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="mt-2 text-center">
              <span className="text-sm font-medium text-white">{user.name}</span>
            </div>
            {selectedUserId === user.id && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

const meta = {
  title: 'Components/UserSelector',
  component: UserSelectorMock,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    selectedUserId: {
      control: 'number',
    },
  },
  args: {
    onUserSelect: fn(),
  },
} satisfies Meta<typeof UserSelectorMock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoSelection: Story = {
  args: {
    selectedUserId: null,
  },
};

export const FirstUserSelected: Story = {
  args: {
    selectedUserId: 1,
  },
};

export const SecondUserSelected: Story = {
  args: {
    selectedUserId: 2,
  },
};

export const ManyUsers: Story = {
  args: {
    selectedUserId: 3,
    users: [
      { id: 1, uuid: 'user-1', name: 'Alice', createdAt: '2023-01-01' },
      { id: 2, uuid: 'user-2', name: 'Bob', createdAt: '2023-01-01' },
      { id: 3, uuid: 'user-3', name: 'Charlie', createdAt: '2023-01-01' },
      { id: 4, uuid: 'user-4', name: 'Diana', createdAt: '2023-01-01' },
      { id: 5, uuid: 'user-5', name: 'Eve', createdAt: '2023-01-01' },
    ],
  },
};

export const LongNames: Story = {
  args: {
    selectedUserId: 2,
    users: [
      { id: 1, uuid: 'user-1', name: 'A', createdAt: '2023-01-01' },
      { id: 2, uuid: 'user-2', name: 'Christopher', createdAt: '2023-01-01' },
      { id: 3, uuid: 'user-3', name: 'Isabella', createdAt: '2023-01-01' },
    ],
  },
};
