import { useEffect } from 'react';
import { toast } from 'react-toastify';

/**
 * Toasts `message` once whenever `error` becomes truthy.
 *
 * The declarative counterpart to `utils/withErrorToast`, which covers the
 * imperative half of the same concern: this one watches a query's `error`
 * field, that one wraps a mutation call.
 */
export function useErrorToast(error: unknown, message: string): void {
  useEffect(() => {
    if (error) toast.error(message);
  }, [error, message]);
}
