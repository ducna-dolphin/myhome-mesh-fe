import { useContext } from 'react';
import { SuperAppContext } from './super-app-context';

export function useSuperApp() {
  const client = useContext(SuperAppContext);
  if (!client) throw new Error('useSuperApp must be used within SuperAppProvider.');
  return client;
}
