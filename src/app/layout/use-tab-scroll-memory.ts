import { useEffect, useLayoutEffect, useRef } from 'react';

/** Remembers the window scroll position per tab path and restores it when the tab is shown again. */
export function useTabScrollMemory(pathname: string) {
  const positions = useRef(new Map<string, number>());
  const current = useRef(pathname);

  useEffect(() => {
    const onScroll = () => positions.current.set(current.current, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    current.current = pathname;
    const saved = positions.current.get(pathname);
    if (saved !== undefined && saved !== window.scrollY) window.scrollTo(0, saved);
  }, [pathname]);
}
