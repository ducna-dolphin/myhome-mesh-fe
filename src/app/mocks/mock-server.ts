import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** MSW server for Vitest; tests may add overrides with `mockServer.use(...)` (reset after each test). */
export const mockServer = setupServer(...handlers);

const LLD_API_PATH = /^\/(mesh|link)\/v\d+\//;

/** Unhandled LLD endpoints fail the test; anything else (assets) is ignored. */
export function onUnhandledRequest(request: Request, print: { error(): void }): void {
  if (LLD_API_PATH.test(new URL(request.url).pathname)) print.error();
}
