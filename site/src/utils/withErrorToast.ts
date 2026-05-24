import { toast } from 'react-toastify';

export async function withErrorToast<T>(errorMessage: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    toast.error(errorMessage);
    throw err;
  }
}
