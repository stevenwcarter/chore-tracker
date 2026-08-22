import { useState, useEffect } from 'react';
import { Admin } from 'types/chore';
import { toast } from 'react-toastify';

/**
 * GETs `/auth/me` with credentials included and resolves to the signed-in `Admin`, or to
 * null when there is no valid admin session (or the request fails, which also toasts).
 */
const checkAdminSession = async (): Promise<Admin | null> => {
  try {
    const response = await fetch('/auth/me', {
      method: 'GET',
      credentials: 'include', // Include cookies
    });

    if (response.ok) {
      const admin: Admin = await response.json();
      return admin;
    } else {
      return null;
    }
  } catch (error) {
    toast.error('Error checking admin session');
    return null;
  }
};

/**
 * Resolves the current admin session once on mount.
 *
 * `isCheckingAuth` starts true so callers can distinguish "no admin" from
 * "not known yet" — the header renders neither nav nor a login button during
 * the check, and the admin pages show a spinner.
 */
export const useAdminSession = (): { currentAdmin: Admin | null; isCheckingAuth: boolean } => {
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    checkAdminSession().then((admin) => {
      setCurrentAdmin(admin);
      setIsCheckingAuth(false);
    });
  }, []);

  return { currentAdmin, isCheckingAuth };
};
