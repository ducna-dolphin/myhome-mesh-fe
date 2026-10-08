import { isTabPath } from '@/shared/config/routes';

/** The only localStorage key the miniapp writes (LLD: no token, password or phone in storage). */
export const LAST_TAB_STORAGE_KEY = 'lastTab';

/** Last visited tab path, or `null` when unknown, invalid or storage is unavailable. */
export function readLastTab(): string | null {
  try {
    const value = window.localStorage.getItem(LAST_TAB_STORAGE_KEY);
    return isTabPath(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLastTab(tabPath: string): void {
  if (!isTabPath(tabPath)) return;
  try {
    window.localStorage.setItem(LAST_TAB_STORAGE_KEY, tabPath);
  } catch {
    // Private mode / disabled storage: remembering the tab is best-effort.
  }
}
