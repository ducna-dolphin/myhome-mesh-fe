import type { PropsWithChildren } from 'react';
import type { SuperAppSession } from '@/shared/super-app';
import { SessionContext } from './session-context';

export function SessionContextProvider({
  session,
  children,
}: PropsWithChildren<{ session: SuperAppSession }>) {
  return <SessionContext.Provider value={{ session }}>{children}</SessionContext.Provider>;
}
