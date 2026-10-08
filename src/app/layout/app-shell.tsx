import { useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { navDirection, useKeyboardInset } from '@/shared/lib';
import { PageChromeProvider } from '@/shared/ui';

/**
 * Sets `<html data-nav>` while a route commits, so the View Transition of a sub-page push/pop
 * (react-router `viewTransition`) slides the right way. It runs inside the transition's update
 * callback, before the pseudo-element animations start.
 */
function useNavDirection() {
  const { pathname } = useLocation();
  const previous = useRef<string | null>(null);
  useLayoutEffect(() => {
    document.documentElement.dataset.nav = navDirection(previous.current, pathname);
    previous.current = pathname;
  }, [pathname]);
}

/** Mobile-width frame; each layout (Internet tabs, sub-page, no-service) draws its own header. */
export function AppShell() {
  useNavDirection();
  useKeyboardInset();
  return (
    <PageChromeProvider>
      <div className="app-shell">
        <Outlet />
      </div>
    </PageChromeProvider>
  );
}
