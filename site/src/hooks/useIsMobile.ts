import { useEffect, useState } from 'react';

/**
 * True when `window.innerWidth` is below `breakpoint`, kept in sync with the
 * window's `resize` event. Checked once synchronously on mount so the first
 * render already reflects the current viewport width.
 */
export function useIsMobile(breakpoint = 600): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
