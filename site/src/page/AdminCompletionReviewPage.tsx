import AdminCompletionReview from 'components/AdminCompletionReview';
import RequireAdmin from './RequireAdmin';

export const AdminCompletionReviewPage = () => (
  <RequireAdmin>{(admin) => <AdminCompletionReview adminId={admin.id} />}</RequireAdmin>
);

export default AdminCompletionReviewPage;
