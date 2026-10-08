import { z } from 'zod';
import { BridgeError } from '@/shared/super-app';

export interface IssuedToken {
  accessToken: string;
  /** Lifetime in seconds. */
  expiresIn: number;
}

export interface TokenManagerOptions {
  /** Asks the host for a fresh MiniApp token (bridge `getMiniAppToken`). */
  fetchToken: () => Promise<IssuedToken>;
  now?: () => number;
  /** Refresh once the remaining lifetime falls below this ratio (LLD §3.6: 20%). */
  refreshRatio?: number;
}

export interface TokenManager {
  /** Cached token, refreshed first when less than 20% of its lifetime remains. */
  getToken(): Promise<string>;
  /**
   * Forces a new token after a 401. Concurrent callers share one host call; passing the rejected
   * token skips the host call when a newer token is already cached.
   */
  refresh(rejectedToken?: string): Promise<string>;
  clear(): void;
}

/** LLD §11.3 `getMiniAppToken` result; anything else is a broken host answer. */
const issuedTokenSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
});

interface CachedToken {
  value: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * MiniApp token holder. Memory only: never written to localStorage, cookies or URLs (LLD §11.1).
 */
export function createTokenManager({
  fetchToken,
  now = Date.now,
  refreshRatio = 0.2,
}: TokenManagerOptions): TokenManager {
  let cached: CachedToken | null = null;
  let inflight: Promise<string> | null = null;

  const isFresh = (token: CachedToken) => {
    const lifetime = token.expiresAt - token.issuedAt;
    return token.expiresAt - now() > lifetime * refreshRatio;
  };

  const refresh = () => {
    if (inflight) return inflight;
    const request = fetchToken()
      .then((result) => {
        const parsed = issuedTokenSchema.safeParse(result);
        // Malformed host answer: same as a failed bridge call, never cached.
        if (!parsed.success) throw new BridgeError('FAILED', 'getMiniAppToken', parsed.error);
        return parsed.data;
      })
      .then(
        (issued) => {
          const issuedAt = now();
          cached = { value: issued.accessToken, issuedAt, expiresAt: issuedAt + issued.expiresIn * 1000 };
          if (inflight === request) inflight = null;
          return issued.accessToken;
        },
        (error: unknown) => {
          if (inflight === request) inflight = null;
          throw error;
        },
      );
    inflight = request;
    return request;
  };

  return {
    getToken() {
      if (cached && isFresh(cached)) return Promise.resolve(cached.value);
      return refresh();
    },
    refresh(rejectedToken?: string) {
      // Another request may already have replaced the token the server rejected.
      if (rejectedToken && cached && cached.value !== rejectedToken && isFresh(cached)) {
        return Promise.resolve(cached.value);
      }
      cached = null;
      return refresh();
    },
    clear() {
      cached = null;
      inflight = null;
    },
  };
}
