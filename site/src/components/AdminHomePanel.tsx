import { Link } from 'react-router-dom';
import { Admin } from 'types/chore';

export const AdminHomePanel = ({ currentAdmin }: { currentAdmin: Admin }) => (
  <div className="text-center py-12">
    <h2 className="text-3xl font-bold text-white mb-4">Welcome back, {currentAdmin.name}!</h2>
    <p className="text-gray-300 mb-8">
      Use the navigation above to manage chores, review completions, or handle payouts.
    </p>
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-white">Quick Actions</h3>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link to="/admin/chores">
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Manage Chores
          </button>
        </Link>
        <Link to="/admin/reviews">
          <button className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors">
            Review Completions
          </button>
        </Link>
      </div>
    </div>
  </div>
);

export default AdminHomePanel;
