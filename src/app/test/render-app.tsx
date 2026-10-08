import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/app/router/routes';
import { i18n } from '@/shared/i18n';
import { SuperAppProvider, type SuperAppClient } from '@/shared/super-app';
import { createFakeSuperAppClient, createTestQueryClient } from '@/shared/test';
import { ToastProvider } from '@/shared/ui';

interface RenderAppOptions {
  /** History stack; the last entry is the current location. */
  entries?: string[];
  superAppClient?: ReturnType<typeof createFakeSuperAppClient>;
}

/** Renders the real route tree in a memory router with the app providers (MSW serves the API). */
export function renderApp({
  entries = ['/'],
  superAppClient = createFakeSuperAppClient(),
}: RenderAppOptions = {}) {
  void i18n.changeLanguage('vi');
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(routes, {
    initialEntries: entries,
    initialIndex: entries.length - 1,
  });
  const client: SuperAppClient = superAppClient;

  const { unmount } = render(
    <I18nextProvider i18n={i18n}>
      <SuperAppProvider client={client}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryClientProvider>
      </SuperAppProvider>
    </I18nextProvider>,
  );

  return { router, queryClient, superAppClient, unmount };
}
