import Footer from 'components/Footer';
import { AppHeader } from 'components/AppHeader';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAdminSession } from 'hooks/useAdminSession';

export const PageTemplate = () => {
  const { currentAdmin, isCheckingAuth } = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col text-white min-h-screen bg-gray-900">
      <AppHeader
        currentAdmin={currentAdmin}
        isCheckingAuth={isCheckingAuth}
        pathname={location.pathname}
        onNavigate={navigate}
        onLogin={() => (window.location.href = '/auth/login')}
        onLogout={() => (window.location.href = '/auth/logout')}
      />

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
