import { createContext } from 'react';
import type { SuperAppSession } from '@/shared/super-app';

export interface SessionContextValue {
  session: SuperAppSession;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
