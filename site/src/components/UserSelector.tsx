import { useQuery } from '@apollo/client';
import { GET_ALL_USERS } from 'graphql/queries';
import { User } from 'types/chore';
import LoadingSpinner from './LoadingSpinner';
import UserImage from './UserImage';
import { useBalances } from 'hooks/useBalances';
import UserBalance from './UserBalance';

interface UserSelectorProps {
  selectedUserId: number | null;
  onUserSelect: (user: User) => void;
  className?: string;
}

export default function UserSelector({
  selectedUserId,
  onUserSelect,
  className = '',
}: UserSelectorProps) {
  const { data, loading, error } = useQuery(GET_ALL_USERS);
  const { balances } = useBalances();

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error loading users: {error.message}</div>;

  const users: User[] = data?.listUsers || [];

  return (
    <div
      className={`flex gap-4 justify-center items-center p-4 bg-gray-800 text-white rounded-lg shadow-md ${className}`}
    >
      <div className="flex gap-3">
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => onUserSelect(user)}
            className={`relative group transition-all duration-200 ${
              selectedUserId === user.id
                ? 'ring-4 ring-blue-500 ring-opacity-50 scale-105'
                : 'hover:scale-105 hover:shadow-lg'
            }`}
          >
            <UserImage user={user} />
            <div className="mt-2 text-center">
              <span className="text-sm font-medium text-white">{user.name}</span>
              <UserBalance name={user.name} balances={balances} />
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
}
