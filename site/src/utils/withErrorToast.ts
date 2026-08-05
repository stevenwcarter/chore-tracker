import { toast } from 'react-toastify';

/**
 * Runs `fn`, and on rejection shows `errorMessage` as a toast and then RE-THROWS.
 *
 * Toasting is not the same as handling: callers that must not propagate the rejection
 * still need their own catch - several components attach an empty one purely to skip the
 * follow-on work after a failure.
 */
export async function withErrorToast<T>(errorMessage: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    toast.error(errorMessage);
    throw err;
  }
}
