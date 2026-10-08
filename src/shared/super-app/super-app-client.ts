import type { MyHomeBridge } from './my-home-bridge';

/** Host session (legacy handler `miniapp.getSession`); only the locale is read. Auth uses `getMiniAppToken`. */
export interface SuperAppSession {
  locale: string;
}

/** Locale used whenever the host does not provide one (the MiniApp is Vietnamese-first). */
export const DEFAULT_LOCALE = 'vi-VN';

/** Host call outside the MyHome bridge contract: the locale comes from the legacy session handler. */
export interface LegacySuperAppCalls {
  /**
   * Locale only; the token comes from `getMiniAppToken`, the data scope from `useSelectedContract`.
   * Best effort: never rejects — a missing, slow, failing or malformed handler yields `DEFAULT_LOCALE`
   * so start-up is never blocked by it.
   */
  getSession(): Promise<SuperAppSession>;
}

export interface SuperAppClient extends MyHomeBridge, LegacySuperAppCalls {
  readonly kind: 'flutter-inappwebview' | 'browser-mock';
}
