import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  commandKeys,
  isTerminalCommand,
  useActiveCommands,
  useCommandPoller,
  type Command,
  type CommandPollStatus,
} from '@/entities/command';
import { healthCheckKeys } from '@/entities/health-check';
import { ontDeviceKeys, useRebootOntDeviceMutation } from '@/entities/ont-device';
import { getCommandErrorMessageKey, isApiError, useErrorMessage, useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useToast } from '@/shared/ui';

export interface UseRebootOntOptions {
  /**
   * Resume a REBOOT still running on the modem (`GET …/commands?active=true`, P0-04). Only REBOOT
   * is picked: commands carry no target, so other types cannot be matched to this screen (R-01).
   */
  resumeActive?: boolean;
  /** Called once the reboot is CONFIRMED (e.g. re-run the line check, P6-01). */
  onConfirmed?: () => void;
}

export interface RebootOntController {
  isDialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  /** Sends the reboot (user confirmed the dialog). */
  confirm: () => void;
  /** POST in flight. */
  isSending: boolean;
  /** Reboot accepted and still being verified (up to 6 minutes). */
  isRebooting: boolean;
  status: CommandPollStatus;
}

/**
 * Reboot of the contract's ONT (P5-02): confirm dialog → `POST …/reboot` (202 Command) → poll the
 * REBOOT command for up to 6 minutes. On CONFIRMED the device info and the latest line check are
 * invalidated (the backend marks the last check stale). 429 RATE_LIMITED (3 per 30 minutes) shows
 * the wait time from `retryAfterSec`.
 */
export function useRebootOnt(
  serialNumber: string,
  { resumeActive = false, onConfirmed }: UseRebootOntOptions = {},
): RebootOntController {
  const { t } = useTranslation('modem');
  const { t: tErrors } = useTranslation('errors');
  const toMessage = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();
  const mutation = useRebootOntDeviceMutation(serialNumber);
  const activeQuery = useActiveCommands(resumeActive ? serialNumber : null);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [own, setOwn] = useState<Command | null>(null);

  const onConfirmedRef = useRef(onConfirmed);
  useEffect(() => {
    onConfirmedRef.current = onConfirmed;
  }, [onConfirmed]);

  // Latch the resumed REBOOT: the active list refetches on focus/reconnect and drops the command
  // once the backend settles it, but the poller must keep tracking it until it observes the end.
  const [resumed, setResumed] = useState<Command | null>(null);
  const activeReboot =
    (resumeActive &&
      activeQuery.data?.find((command) => command.type === 'REBOOT' && !isTerminalCommand(command))) ||
    null;
  if (activeReboot && !own && !resumed) setResumed(activeReboot);
  const tracked = own ?? resumed ?? activeReboot;

  const handleSettled = useCallback(
    (command: Command) => {
      void queryClient.invalidateQueries({ queryKey: commandKeys.active(serialNumber) });
      if (command.state === 'CONFIRMED') {
        void queryClient.invalidateQueries({ queryKey: ontDeviceKeys.detail(serialNumber) });
        void queryClient.invalidateQueries({ queryKey: healthCheckKeys.latest(serialNumber) });
        toast.show(t('reboot.done'));
        onConfirmedRef.current?.();
      } else {
        toast.show(tErrors(getCommandErrorMessageKey(command.errorCode)), { tone: 'danger' });
      }
    },
    [queryClient, serialNumber, t, tErrors, toast],
  );

  const poller = useCommandPoller(tracked?.commandId ?? null, {
    type: 'REBOOT',
    initialCommand: tracked,
    onSettled: handleSettled,
  });

  const timedOutFor = useRef<string | null>(null);
  useEffect(() => {
    if (poller.status !== 'timeout' || !tracked || timedOutFor.current === tracked.commandId) return;
    timedOutFor.current = tracked.commandId;
    toast.show(tErrors('command.TIMEOUT'));
  }, [poller.status, tracked, tErrors, toast]);

  const confirm = useCallback(() => {
    mutation.mutate(
      { idempotencyKey: keys.forAction('reboot') },
      {
        onSuccess: (command) => {
          keys.renew();
          setOwn(command);
          setDialogOpen(false);
        },
        onError: (error) => {
          setDialogOpen(false);
          if (isApiError(error) && error.code === 'RATE_LIMITED') {
            const seconds = error.retryAfterSec;
            toast.show(
              seconds
                ? t('reboot.rateLimited', { minutes: Math.max(1, Math.ceil(seconds / 60)) })
                : t('reboot.rateLimitedNoTime'),
              { tone: 'danger', duration: 6_000 },
            );
            keys.renew();
            return;
          }
          toast.show(toMessage(error), { tone: 'danger' });
        },
      },
    );
  }, [keys, mutation, t, toMessage, toast]);

  return {
    isDialogOpen,
    openDialog: useCallback(() => setDialogOpen(true), []),
    closeDialog: useCallback(() => setDialogOpen(false), []),
    confirm,
    isSending: mutation.isPending,
    isRebooting: tracked !== null && poller.status === 'polling',
    status: poller.status,
  };
}
