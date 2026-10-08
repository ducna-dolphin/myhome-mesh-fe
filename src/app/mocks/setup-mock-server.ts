// Vitest setup file (see vite.config.ts): MSW node server for every test, reset between tests.
//
// Modules are imported lazily in `beforeAll`: a static import here would evaluate `@/shared/api`
// and `@/shared/super-app` before a test file's hoisted `vi.mock(...)`, so those mocks would be
// ignored by modules loaded during setup.
import { afterAll, afterEach, beforeAll } from 'vitest';

type Runtime = {
  server: (typeof import('./mock-server'))['mockServer'];
  reset: () => void;
};

let runtime: Runtime | null = null;

beforeAll(async () => {
  const [{ mockServer, onUnhandledRequest }, { resetMockDb }, mock, api] = await Promise.all([
    import('./mock-server'),
    import('./handlers'),
    import('@/shared/api/mock'),
    import('@/shared/api'),
  ]);
  mockServer.listen({ onUnhandledRequest });
  runtime = {
    server: mockServer,
    reset: () => {
      mock.resetMockScenario();
      resetMockDb();
      // A test file may mock `@/shared/api`; only reset auth when the real helper exists.
      if (typeof api.resetApiAuth === 'function') api.resetApiAuth();
    },
  };
});

afterEach(() => {
  runtime?.server.resetHandlers();
  runtime?.reset();
});

afterAll(() => {
  runtime?.server.close();
});
