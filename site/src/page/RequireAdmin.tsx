import { ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import LoadingSpinner from 'components/LoadingSpinner';
import { Admin } from 'types/chore';

/** Shape PageTemplate publishes through its `<Outlet context={...} />`. */
export interface OutletContext {
  currentAdmin: Admin | null;
  isCheckingAuth: boolean;
}

const AccessDenied = () => (
  <div className="flex flex-col items-center justify-center min-h-96 text-center">
    <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
    <p className="text-gray-300 mb-6">You need to be logged in as an admin to access this page.</p>
    <button
      onClick={() => (window.location.href = '/auth/login')}
      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
    >
      Login as Admin
    </button>
  </div>
);

interface RequireAdminProps {
  /** Rendered only once an admin session is confirmed. */
  children: (admin: Admin) => ReactNode;
}

/**
 * Route guard for the three admin pages: spinner while the session check is in
 * flight, an Access Denied panel when there is no admin, and the child render
 * prop once an admin is confirmed.
 */
export const RequireAdmin = ({ children }: RequireAdminProps) => {
  const { currentAdmin, isCheckingAuth } = useOutletContext<OutletContext>();

  if (isCheckingAuth) return <LoadingSpinner />;
  if (!currentAdmin) return <AccessDenied />;

  return <>{children(currentAdmin)}</>;
};

export default RequireAdmin;
