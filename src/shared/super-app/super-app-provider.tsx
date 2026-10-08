import type { PropsWithChildren } from 'react';
import type { SuperAppClient } from './super-app-client';
import { SuperAppContext } from './super-app-context';

export function SuperAppProvider({ client, children }: PropsWithChildren<{ client: SuperAppClient }>) {
  return <SuperAppContext.Provider value={client}>{children}</SuperAppContext.Provider>;
}
