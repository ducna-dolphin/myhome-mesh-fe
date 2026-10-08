import type { SuperAppClient, SuperAppSession } from './super-app-client';

export interface SuperAppSessionCache {
  getSession(): Promise<SuperAppSession>;
}

/** Memoizes the host session (locale) and retries after a failure instead of caching it. */
export function createSessionCache(client: Pick<SuperAppClient, 'getSession'>): SuperAppSessionCache {
  let pending: Promise<SuperAppSession> | null = null;

  return {
    getSession() {
      if (pending) return pending;
      const request = client.getSession().catch((error: unknown) => {
        if (pending === request) pending = null;
        throw error;
      });
      pending = request;
      return request;
    },
  };
}
