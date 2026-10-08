import type { MyHomeBridge, Platform } from '@/shared/super-app';

const IOS_USER_AGENT = /iPhone|iPad|iPod/i;

export function platformFromUserAgent(userAgent: string): Platform {
  return IOS_USER_AGENT.test(userAgent) ? 'IOS' : 'ANDROID';
}

/** `getAppInfo().platform` (S-01); falls back to the WebView user agent when the host lacks it. */
export async function detectPlatform(
  bridge: Pick<MyHomeBridge, 'supports' | 'getAppInfo'>,
  userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): Promise<Platform> {
  if (bridge.supports('getAppInfo')) {
    try {
      return (await bridge.getAppInfo()).platform;
    } catch {
      // Unconfirmed host function: fall through to the user agent.
    }
  }
  return platformFromUserAgent(userAgent);
}
