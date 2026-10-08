import { createContext, useContext, useLayoutEffect } from 'react';

interface PageChromeContextValue {
  overrideTitle?: string;
  setOverrideTitle: (title?: string) => void;
}

/** Lets a page override the header title of its layout (e.g. a device name on a sub-page). */
export const PageChromeContext = createContext<PageChromeContextValue>({
  setOverrideTitle: () => undefined,
});

// Layout effects so overrides are cleared before the next route paints (no stale chrome flash).
export function usePageTitle(title: string) {
  const { setOverrideTitle } = useContext(PageChromeContext);

  useLayoutEffect(() => {
    setOverrideTitle(title);
    return () => setOverrideTitle(undefined);
  }, [setOverrideTitle, title]);
}

export function usePageTitleOverride() {
  return useContext(PageChromeContext).overrideTitle;
}
