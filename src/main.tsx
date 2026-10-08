import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from '@/app/providers/app-providers';
import { router } from '@/app/router/app-router';
import { env } from '@/shared/config/env';
import { ErrorBoundary } from '@/shared/ui';
import '@/app/styles/global.css';

async function enableApiMocks(): Promise<void> {
  // The static `import.meta.env` check lets Vite drop the MSW chunk from remote builds entirely.
  if (import.meta.env.VITE_API_MODE === 'remote' || env.VITE_API_MODE !== 'mock') return;
  const { startMockWorker } = await import('@/app/mocks/browser');
  await startMockWorker();
}

void enableApiMocks().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <AppProviders>
          <RouterProvider router={router} />
        </AppProviders>
      </ErrorBoundary>
    </StrictMode>,
  );
});
