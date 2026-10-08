import { useCallback, useEffect, useRef, useState } from 'react';
import { useRevealWifiPasswordMutation } from '@/entities/wifi-network';

/** LLD §11.5: a revealed password is re-masked and dropped from memory after 60 seconds. */
export const PASSWORD_VISIBLE_MS = 60_000;

export interface UseRevealedWifiPasswordOptions {
  visibleMs?: number;
  onError?: (error: unknown) => void;
}

export interface RevealedWifiPassword {
  /** Plain password while visible, otherwise `null`. Lives only in this component's state. */
  password: string | null;
  isPending: boolean;
  reveal: () => void;
  hide: () => void;
}

/**
 * "Eye" button logic (P3-01, purpose VIEW). The reveal is a mutation (POST, never cached); its
 * result is copied into local state and the mutation is reset at once, so the password is not
 * kept in the TanStack cache. Auto-hides after `visibleMs`; unmounting drops the state.
 */
export function useRevealedWifiPassword(
  serialNumber: string,
  wifiIndex: number,
  { visibleMs = PASSWORD_VISIBLE_MS, onError }: UseRevealedWifiPasswordOptions = {},
): RevealedWifiPassword {
  const { mutate, reset, isPending } = useRevealWifiPasswordMutation(serialNumber);
  const [password, setPassword] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setPassword(null);
  }, [clearTimer]);

  const reveal = useCallback(() => {
    mutate(
      { wifiIndex, purpose: 'VIEW' },
      {
        onSuccess: (result) => {
          reset();
          clearTimer();
          setPassword(result.password);
          timer.current = setTimeout(() => {
            timer.current = null;
            setPassword(null);
          }, visibleMs);
        },
        onError: (error) => {
          reset();
          onError?.(error);
        },
      },
    );
  }, [clearTimer, mutate, onError, reset, visibleMs, wifiIndex]);

  useEffect(() => clearTimer, [clearTimer]);

  return { password, isPending, reveal, hide };
}
