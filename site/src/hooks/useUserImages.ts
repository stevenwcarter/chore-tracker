import { toast } from 'react-toastify';
import { withErrorToast } from 'utils/withErrorToast';

/**
 * Owns the raw `fetch` calls behind a user's profile image (upload/remove), plus the
 * `refetchUsers()` that must follow a successful write so the new image shows up.
 *
 * Both operations only toast once: an HTTP-level failure (response not `ok`) toasts its
 * specific message and resolves normally; a thrown/network error is caught by
 * `withErrorToast`, which toasts a generic message and re-throws. Callers that don't want
 * that rejection to become an unhandled promise rejection (e.g. a fire-and-forget `onChange`
 * handler) need their own catch - see `AdminChoreManagement`'s `handleImageUpload`/
 * `handleRemoveImage`.
 */
export function useUserImages(refetchUsers: () => Promise<unknown>) {
  const uploadImage = (userUuid: string, file: File) =>
    withErrorToast('Error uploading image', async () => {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`/images/upload/${userUuid}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await refetchUsers();
      } else {
        toast.error('Failed to upload image');
      }
    });

  const removeImage = (userId: number) =>
    withErrorToast('Error removing image', async () => {
      const response = await fetch(`/images/user/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await refetchUsers();
      } else {
        toast.error('Failed to remove image');
      }
    });

  return { uploadImage, removeImage };
}
