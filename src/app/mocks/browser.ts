import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * Starts the MSW service worker for `VITE_API_MODE=mock`. Only the LLD endpoints are mocked;
 * other requests (assets, fonts) pass through.
 */
export async function startMockWorker(): Promise<void> {
  const worker = setupWorker(...handlers);
  try {
    await worker.start({
      onUnhandledRequest: 'bypass',
      quiet: true,
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
  } catch (error) {
    // e.g. WebView without service-worker support: API calls then fail visibly instead of silently.
    console.warn('[msw] Mock worker failed to start; LLD API calls will hit the network.', error);
  }
}
