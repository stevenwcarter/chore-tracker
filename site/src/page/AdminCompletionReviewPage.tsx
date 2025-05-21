import { useOutletContext } from 'react-router-dom';
import AdminCompletionReview from '../components/AdminCompletionReview';
import LoadingSpinner from '../components/LoadingSpinner';
import { Admin } from '../types/chore';

interface OutletContext {
  currentAdmin: Admin | null;
  isCheckingAuth: boolean;
}

export const AdminCompletionReviewPage = () => {
  const { currentAdmin, isCheckingAuth } = useOutletContext<OutletContext>();

  if (isCheckingAuth) {
    return <LoadingSpinner />;
  }

  if (!currentAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
        <p className="text-gray-300 mb-6">
          You need to be logged in as an admin to access this page.
        </p>
        <button
          onClick={() => (window.location.href = '/auth/login')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Login as Admin
        </button>
      </div>
    );
  }

  return <AdminCompletionReview adminId={currentAdmin.id} />;
};

export default AdminCompletionReviewPage;
