import { createBrowserMockAdapter } from './adapters/browser-mock-adapter';
import {
  createFlutterInAppWebViewAdapter,
  hasFlutterInAppWebViewBridge,
} from './adapters/flutter-inappwebview-adapter';
import type { SuperAppClient } from './super-app-client';

export function createSuperAppClient(): SuperAppClient {
  // The Flutter bridge can be injected after this module is evaluated.
  // Production must never silently fall back to a browser mock session.
  if (import.meta.env.PROD || hasFlutterInAppWebViewBridge()) return createFlutterInAppWebViewAdapter();
  return createBrowserMockAdapter();
}
