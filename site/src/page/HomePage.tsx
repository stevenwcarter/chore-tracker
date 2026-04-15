import { useOutletContext } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { User, Admin } from 'types/chore';
import UserSelector from 'components/UserSelector';
import WeeklyChoreView from 'components/WeeklyChoreView';
import LoadingSpinner from 'components/LoadingSpinner';
import AdminHomePanel from 'components/AdminHomePanel';

interface OutletContext {
  currentAdmin: Admin | null;
  isCheckingAuth: boolean;
}

const USER_AUTO_DESELECT_MS = 5 * 60 * 1000; // 5 minutes

export const HomePage = () => {
  const { currentAdmin, isCheckingAuth } = useOutletContext<OutletContext>();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const deselectTimer = useRef<number | undefined>(null);

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
  };

  useEffect(() => {
    // Clear any existing timer
    if (deselectTimer.current) {
      clearTimeout(deselectTimer.current);
      deselectTimer.current = null;
    }

    // If a user is selected, start a new timer
    if (selectedUser) {
      deselectTimer.current = setTimeout(() => {
        setSelectedUser(null);
      }, USER_AUTO_DESELECT_MS);
    }

    // Cleanup on unmount
    return () => {
      if (deselectTimer.current) {
        clearTimeout(deselectTimer.current);
      }
    };
  }, [selectedUser]);

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
