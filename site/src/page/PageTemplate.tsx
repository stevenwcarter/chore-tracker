import Footer from 'components/Footer';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Admin } from '../types/chore';

// Real admin session check that calls the backend
const checkAdminSession = async (): Promise<Admin | null> => {
  try {
    const response = await fetch('/auth/me', {
      method: 'GET',
      credentials: 'include', // Include cookies
    });

    if (response.ok) {
      const admin: Admin = await response.json();
      return admin;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error checking admin session:', error);
    return null;
  }
};

export const PageTemplate = () => {
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminSession().then((admin) => {
      setCurrentAdmin(admin);
      setIsCheckingAuth(false);
    });
  }, []);

  const handleAdminLogin = () => {
    window.location.href = '/auth/login';
  };

  const handleAdminLogout = () => {
    window.location.href = '/auth/logout';
  };

  return (
    <div className="h-full flex flex-col text-white min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 text-white shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center py-4 lg:py-0 lg:h-16 gap-4 lg:gap-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
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
                <nav className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => navigate('/admin/chores')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      location.pathname === '/admin/chores'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    Chore Management
                  </button>
                  <button
                    onClick={() => navigate('/admin/reviews')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      location.pathname === '/admin/reviews'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    Review Completions
                  </button>
                  <button
                    onClick={() => navigate('/admin/payouts')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      location.pathname === '/admin/payouts'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    Payout System
                  </button>
                </nav>
                <button
                  onClick={handleAdminLogout}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-500 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : !isCheckingAuth ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleAdminLogin}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Admin Login
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <div className="flex flex-col p-4 md:p-10">
          <Outlet context={{ currentAdmin, isCheckingAuth }} />
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default PageTemplate;
