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
      {currentAdmin && <AdminHomePanel currentAdmin={currentAdmin} />}
      <UserSelector selectedUserId={null} onUserSelect={handleUserSelect} />
      {selectedUser && <WeeklyChoreView user={selectedUser} onBack={() => setSelectedUser(null)} />}
    </div>
  );
};

export default HomePage;
