import { useState } from 'react';
import { createUuid } from '@/shared/lib/create-uuid';

/** Mutation variables for write APIs: every write carries the key of the user action (CF §2.3). */
export interface IdempotentVariables {
  idempotencyKey: string;
}

export type WithIdempotencyKey<T> = T & IdempotentVariables;

export function createIdempotencyKey(): string {
  return createUuid();
}

export interface IdempotencyKeyHolder {
  /**
   * Key for the current user action. Repeated calls with the same input return the same key, so a
   * retry after a network error replays safely; different input means a new action and a new key
   * (same key + different body would be `422 IDEMPOTENCY_KEY_REUSED`). The input is kept as a
   * JSON fingerprint: never pass secrets (e.g. a Wi-Fi password) — pass a length/edit counter.
   */
  forAction(input?: unknown): string;
  /** Ends the current action (call after success); the next `forAction` creates a new key. */
  renew(): void;
}

export function createIdempotencyKeyHolder(
  createKey: () => string = createIdempotencyKey,
): IdempotencyKeyHolder {
  let current: { fingerprint: string; key: string } | null = null;

  return {
    forAction(input) {
      const fingerprint = JSON.stringify(input ?? null);
      if (!current || current.fingerprint !== fingerprint) current = { fingerprint, key: createKey() };
      return current.key;
    },
    renew() {
      current = null;
    },
  };
}

/**
 * Per-component idempotency key holder.
 *
 * ```ts
 * const keys = useIdempotencyKey();
 * mutation.mutate(
 *   { wifiIndex, patch, idempotencyKey: keys.forAction({ wifiIndex, patch }) },
 *   { onSuccess: keys.renew },
 * );
 * ```
 */
export function useIdempotencyKey(): IdempotencyKeyHolder {
  const [holder] = useState(() => createIdempotencyKeyHolder());
  return holder;
}
