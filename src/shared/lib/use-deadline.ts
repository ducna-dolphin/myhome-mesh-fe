import { useEffect, useState } from 'react';

/**
 * Returns `true` once `limitMs` has passed while `active` stayed true for the same `key`.
 * Used to give up polling (commands, health checks) without treating it as a failure.
 */
export function useDeadline(key: string | null, limitMs: number, active: boolean): boolean {
  const [expiredKey, setExpiredKey] = useState<string | null>(null);

  useEffect(() => {
    if (key === null || !active) return;
    const timer = setTimeout(() => setExpiredKey(key), limitMs);
    return () => clearTimeout(timer);
  }, [key, limitMs, active]);

  return key !== null && expiredKey === key;
}
