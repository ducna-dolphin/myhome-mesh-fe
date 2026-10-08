/** Navigation direction between two paths: deeper = `forward`, shallower = `back`. */
export type NavDirection = 'forward' | 'back' | 'none';

function depth(pathname: string): number {
  return pathname.split('/').filter(Boolean).length;
}

/**
 * `/wifi` → `/wifi/0/edit` is `forward`, the reverse is `back`, tab ↔ tab is `none` (no slide).
 * Drives the View Transition direction of sub-page navigation.
 */
export function navDirection(from: string | null, to: string): NavDirection {
  if (from === null || from === to) return 'none';
  const delta = depth(to) - depth(from);
  if (delta > 0) return 'forward';
  if (delta < 0) return 'back';
  return 'none';
}
