import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { PropsWithChildren, ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { i18n, resolveLocale } from '@/shared/i18n';
import { SessionContextProvider } from '@/shared/session';
import { SuperAppProvider, type SuperAppClient, type SuperAppSession } from '@/shared/super-app';
import { ToastProvider } from '@/shared/ui';
import { createFakeSuperAppClient } from './fake-super-app-client';

const defaultSession: SuperAppSession = {
  locale: 'vi-VN',
};

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  path?: string;
  session?: SuperAppSession;
  queryClient?: QueryClient;
  superAppClient?: SuperAppClient;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    path = '*',
    session = defaultSession,
    queryClient = createTestQueryClient(),
    superAppClient = createFakeSuperAppClient(session),
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  void i18n.changeLanguage(resolveLocale(session.locale));

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <I18nextProvider i18n={i18n}>
        <SuperAppProvider client={superAppClient}>
          <QueryClientProvider client={queryClient}>
            <SessionContextProvider session={session}>
              <ToastProvider>
                <MemoryRouter initialEntries={[route]}>
                  <Routes>
                    <Route path={path} element={children} />
                  </Routes>
                </MemoryRouter>
              </ToastProvider>
            </SessionContextProvider>
          </QueryClientProvider>
        </SuperAppProvider>
      </I18nextProvider>
    );
  }

  return {
    queryClient,
    superAppClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
