import { useQuery } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { SessionContextProvider } from '@/shared/session';
import { DEFAULT_LOCALE, getSession, type SuperAppSession } from '@/shared/super-app';
import { LoadingState } from '@/shared/ui';
import { I18nProvider } from './i18n-provider';

const sessionKey = ['super-app', 'session'] as const;

/** The legacy session only carries the locale: any failure falls back to Vietnamese. */
const loadSession = (): Promise<SuperAppSession> => getSession().catch(() => ({ locale: DEFAULT_LOCALE }));

/**
 * Applies the host locale before rendering the app. `getSession` is outside the MyHome contract, so
 * it is bounded by a timeout in the adapter and can never block start-up or show an error screen.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  const query = useQuery({
    queryKey: sessionKey,
    queryFn: loadSession,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  if (query.isPending) return <LoadingState />;
  const session = query.data ?? { locale: DEFAULT_LOCALE };

  return (
    <I18nProvider locale={session.locale}>
      <SessionContextProvider session={session}>{children}</SessionContextProvider>
    </I18nProvider>
  );
}
