import AdminChoreManagement from 'components/AdminChoreManagement';
import RequireAdmin from './RequireAdmin';

export const AdminChoreManagementPage = () => (
  <RequireAdmin>{(admin) => <AdminChoreManagement adminId={admin.id} />}</RequireAdmin>
);

export default AdminChoreManagementPage;
