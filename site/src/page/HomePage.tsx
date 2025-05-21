import { useOutletContext } from 'react-router-dom';
import { useState } from 'react';
import { User, Admin } from '../types/chore';
import UserSelector from '../components/UserSelector';
import WeeklyChoreView from '../components/WeeklyChoreView';
import LoadingSpinner from '../components/LoadingSpinner';
import AdminHomePanel from 'components/AdminHomePanel';

interface OutletContext {
  currentAdmin: Admin | null;
  isCheckingAuth: boolean;
}

export const HomePage = () => {
  const { currentAdmin, isCheckingAuth } = useOutletContext<OutletContext>();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
  };

  if (isCheckingAuth) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {selectedUser ? (
        <WeeklyChoreView user={selectedUser} onBack={() => setSelectedUser(null)} />
      ) : (
        currentAdmin && <AdminHomePanel currentAdmin={currentAdmin} />
      )}
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-200 mb-4">Welcome to Chore Tracker!</h2>
          <p className="text-gray-300 mb-8">
            Track your chores and earn rewards for completing them.
          </p>
        </div>

        <UserSelector selectedUserId={null} onUserSelect={handleUserSelect} />
      </div>
    </div>
  );
};

export default HomePage;
