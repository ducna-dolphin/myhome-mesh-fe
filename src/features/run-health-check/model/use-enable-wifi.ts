import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { commandApi, isTerminalCommand, type Command } from '@/entities/command';
import { wifiNetworkApi, wifiNetworkKeys } from '@/entities/wifi-network';
import {
  type ApiError,
  COMMAND_POLL_LIMIT_MS,
  commandPollIntervalMs,
  createIdempotencyKey,
  isApiError,
  useErrorMessage,
} from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useToast } from '@/shared/ui';

class AbortedError extends Error {}

/**
 * LLD §11.4: 409/429/503 with `retryAfterSec` (and 409 DEVICE_BUSY) mean "try later" — never
 * retried automatically. The sequence stops and the user taps "Bật Wi-Fi" again (new keys).
 */
function isTryLater(error: unknown): error is ApiError {
  return isApiError(error) && (error.retryAfterSec !== undefined || error.code === 'DEVICE_BUSY');
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new AbortedError());
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortedError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Polls the command until CONFIRMED/FAILED; gives up after 2 minutes (UNKNOWN is not an error). */
async function settleCommand(command: Command, signal: AbortSignal): Promise<Command> {
  let current = command;
  const deadline = Date.now() + COMMAND_POLL_LIMIT_MS;
  while (!isTerminalCommand(current) && Date.now() < deadline) {
    await sleep(commandPollIntervalMs(current), signal);
    try {
      current = await commandApi.get(current.commandId, signal);
    } catch (error) {
      if (signal.aborted) throw new AbortedError();
      // Network hiccup while the Wi-Fi restarts: keep polling until the deadline.
      void error;
    }
  }
  return current;
}

/** PATCH `enabled=true` with a fresh key per user action, then polls the command. */
async function enableNetwork(serialNumber: string, wifiIndex: number, signal: AbortSignal) {
  const idempotencyKey = createIdempotencyKey();
  let command: Command;
  try {
    command = await wifiNetworkApi.update(serialNumber, wifiIndex, { enabled: true }, idempotencyKey, signal);
  } catch (error) {
    if (signal.aborted) throw new AbortedError();
    throw error;
  }
  return settleCommand(command, signal);
}

export interface EnableWifiController {
  run: () => void;
  isRunning: boolean;
}

/**
 * "Bật Wi-Fi" action of the OFF result (P6-01 → P3-02): turns on every disabled network one by one
 * (the list excludes guest networks, Q-11), waiting for each command to settle because the modem
 * takes one write at a time (P0-04). Then calls `onDone` to re-run the check.
 */
export function useEnableWifi(serialNumber: string, { onDone }: { onDone?: () => void } = {}) {
  const { t } = useTranslation('quality');
  const toMessage = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(() => {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);

    void (async () => {
      let failed = false;
      let tryLater: ApiError | null = null;
      try {
        const { data: networks } = await wifiNetworkApi.list(serialNumber, controller.signal);
        for (const network of networks.filter((item) => !item.enabled)) {
          try {
            const settled = await enableNetwork(serialNumber, network.wifiIndex, controller.signal);
            if (settled.state === 'FAILED') failed = true;
          } catch (error) {
            if (error instanceof AbortedError || controller.signal.aborted) throw error;
            if (isTryLater(error)) {
              tryLater = error;
              break;
            }
            failed = true;
          }
        }
      } catch (error) {
        if (error instanceof AbortedError || controller.signal.aborted) return;
        if (isTryLater(error)) tryLater = error;
        else failed = true;
      }
      controllerRef.current = null;
      setRunning(false);
      void queryClient.invalidateQueries({ queryKey: wifiNetworkKeys.list(serialNumber) });
      if (tryLater) {
        // Stop here: the OFF result and its "Bật Wi-Fi" button stay for a manual retry.
        const seconds = tryLater.retryAfterSec;
        toast.show(seconds ? t('enableWifi.retryAfter', { seconds }) : toMessage(tryLater), {
          tone: 'danger',
          duration: 6_000,
        });
        return;
      }
      toast.show(t(failed ? 'enableWifi.failed' : 'enableWifi.done'), failed ? { tone: 'danger' } : {});
      onDoneRef.current?.();
    })();
  }, [queryClient, serialNumber, t, toMessage, toast]);

  return { run, isRunning } satisfies EnableWifiController;
}
