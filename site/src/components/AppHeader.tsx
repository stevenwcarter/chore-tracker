import { Admin } from 'types/chore';
import { AdminNav, AdminNavItem } from './AdminNav';

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { path: '/admin/chores', label: 'Chore Management' },
  { path: '/admin/reviews', label: 'Review Completions' },
  { path: '/admin/payouts', label: 'Payout System' },
];

interface AppHeaderProps {
  currentAdmin: Admin | null;
  isCheckingAuth: boolean;
  pathname: string;
  onNavigate: (path: string) => void;
  onLogin: () => void;
  onLogout: () => void;
}

export const AppHeader = ({
  currentAdmin,
  isCheckingAuth,
  pathname,
  onNavigate,
  onLogin,
  onLogout,
}: AppHeaderProps) => (
  <header className="bg-gray-800 text-white shadow-sm border-b border-gray-700">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center py-4 lg:py-0 lg:h-16 gap-4 lg:gap-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('/')}
            className="text-xl sm:text-2xl font-bold text-white hover:text-blue-300 transition-colors cursor-pointer"
          >
            Chore Tracker
          </button>
          {currentAdmin && (
            <span className="px-3 py-1 bg-blue-600 text-blue-100 rounded-full text-sm font-medium">
              Admin: {currentAdmin.name}
            </span>
          )}
        </div>

        {currentAdmin ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <AdminNav items={ADMIN_NAV_ITEMS} pathname={pathname} onNavigate={onNavigate} />
            <button
              onClick={onLogout}
              className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-500 transition-colors"
            >
              Logout
            </button>
          </div>
        ) : !isCheckingAuth ? (
          <div className="flex items-center gap-4">
            <button
              onClick={onLogin}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Admin Login
            </button>
          </div>
        ) : null}
      </div>
    </div>
  </header>
);

export default AppHeader;
