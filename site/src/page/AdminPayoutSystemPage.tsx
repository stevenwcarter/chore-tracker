import AdminPayoutSystem from 'components/AdminPayoutSystem';
import RequireAdmin from './RequireAdmin';

export const AdminPayoutSystemPage = () => (
  <RequireAdmin>{(admin) => <AdminPayoutSystem adminId={admin.id} />}</RequireAdmin>
);

export default AdminPayoutSystemPage;
