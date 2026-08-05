import { useEffect, useState } from 'react';

/**
 * Returns the previous value until `delay` milliseconds have elapsed with no further change
 * to `value`, then returns the latest one. The delay defaults to 500 ms, and changing either
 * `value` or `delay` restarts the timer.
 */
function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
