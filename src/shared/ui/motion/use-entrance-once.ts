import { useEffect, useState } from 'react';

const played = new Set<string>();

/**
 * True for the first render of `key` in this session (in memory only), so list entrances play on
 * the first data load and not again when the user comes back to a tab with cached data.
 * Pass `ready = true` once the data is on screen; the key is marked as played then.
 */
export function useEntranceOnce(key: string, ready: boolean): boolean {
  const [animate] = useState(() => !played.has(key));
  useEffect(() => {
    if (ready) played.add(key);
  }, [key, ready]);
  return animate;
}

/** Test helper: forget which entrances already played. */
export function resetEntrances(): void {
  played.clear();
}
