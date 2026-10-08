import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSuperAppClient } from '@/shared/super-app';

describe('createSuperAppClient', () => {
  afterEach(() => {
    delete window.flutter_inappwebview;
    vi.unstubAllEnvs();
  });

  it('uses browser adapter outside Flutter', () => {
    delete window.flutter_inappwebview;
    expect(createSuperAppClient().kind).toBe('browser-mock');
  });

  it('uses Flutter adapter when the bridge object is present', () => {
    window.flutter_inappwebview = {
      callHandler: async <T = unknown>() => undefined as T,
    };
    expect(createSuperAppClient().kind).toBe('flutter-inappwebview');
  });

  it('waits for a late Flutter bridge in production', async () => {
    vi.stubEnv('PROD', true);
    delete window.flutter_inappwebview;
    const client = createSuperAppClient();
    expect(client.kind).toBe('flutter-inappwebview');

    const pending = client.getSession();
    window.flutter_inappwebview = {
      callHandler: async <T = unknown>() => ({ locale: 'en-US' }) as T,
    };
    window.dispatchEvent(new Event('flutterInAppWebViewPlatformReady'));

    await expect(pending).resolves.toEqual({ locale: 'en-US' });
  });
});
