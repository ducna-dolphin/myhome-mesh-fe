import type { PropsWithChildren } from 'react';
import { superApp, SuperAppProvider } from '@/shared/super-app';
import { ToastProvider } from '@/shared/ui';
import { QueryProvider } from './query-provider';
import { SessionProvider } from './session-provider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SuperAppProvider client={superApp}>
      <QueryProvider>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </QueryProvider>
    </SuperAppProvider>
  );
}
