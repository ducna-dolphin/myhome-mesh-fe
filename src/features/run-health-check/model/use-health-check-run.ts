import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isTerminalHealthCheck,
  useCreateHealthCheckMutation,
  useHealthCheckQuery,
  useLatestHealthCheckQuery,
  type HealthCheck,
} from '@/entities/health-check';
import { createIdempotencyKey } from '@/shared/api';

export interface HealthCheckRun {
  /** Check to display: the running/finished one, or the latest stored one while the POST is pending. */
  check: HealthCheck | null;
  /** POST pending or the check is still being polled. */
  isRunning: boolean;
  /** Polling gave up after 3 minutes; `check` is then shown as FAILED (P6-01 proposal). */
  isTimedOut: boolean;
  /** POST failed (e.g. 409 DEVICE_BUSY). */
  startError: unknown;
  /** Sends `POST …/health-checks` again with a new idempotency key. */
  recheck: () => void;
}

/** A run past the 3-minute limit counts as FAILED: unfinished items become FAILED (BR-70). */
export function markTimedOut(check: HealthCheck): HealthCheck {
  return {
    ...check,
    state: 'FAILED',
    overallStatus: 'INCOMPLETE',
    items: check.items.map((item) =>
      item.state === 'DONE' || item.state === 'FAILED'
        ? item
        : { ...item, state: 'FAILED', status: null, action: null },
    ),
  };
}

/**
 * Line-quality check of the Quality tab (P6-01). Each tab entry sends `POST …/health-checks` with
 * its own idempotency key; the backend answers 200 with a fresh (< 30 min) result or 202 with a
 * running check, which is polled every 3s until DONE/FAILED (max 3 minutes). Until the POST
 * returns, the latest stored check (`GET ?limit=1`) is shown. Polling stops on unmount.
 */
export function useHealthCheckRun(serialNumber: string): HealthCheckRun {
  const latestQuery = useLatestHealthCheckQuery(serialNumber);
  const mutation = useCreateHealthCheckMutation(serialNumber);
  const [entryKey, setEntryKey] = useState(createIdempotencyKey);
  const startedKey = useRef<string | null>(null);
  const { mutate } = mutation;

  useEffect(() => {
    // Guarded per key so StrictMode's double effect does not send a second POST.
    if (startedKey.current === entryKey) return;
    startedKey.current = entryKey;
    mutate({ idempotencyKey: entryKey });
  }, [entryKey, mutate]);

  const created = mutation.data?.check ?? null;
  const poll = useHealthCheckQuery(serialNumber, created?.checkId ?? null, { initialCheck: created });

  const check = useMemo(() => {
    const current = poll.check ?? (created ? null : (latestQuery.data ?? null));
    if (!current) return null;
    return poll.isTimedOut && !isTerminalHealthCheck(current) ? markTimedOut(current) : current;
  }, [poll.check, poll.isTimedOut, created, latestQuery.data]);

  const recheck = useCallback(() => setEntryKey(createIdempotencyKey()), []);

  return {
    check,
    isRunning: mutation.isPending || poll.isPolling,
    isTimedOut: poll.isTimedOut,
    startError: mutation.error,
    recheck,
  };
}
