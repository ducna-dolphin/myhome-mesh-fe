import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
  connectedDeviceKeys,
  isSelfDevice,
  removeConnectedDeviceFromCache,
  useRemoveConnectedDeviceMutation,
  useSelfDeviceIdentity,
  type ConnectedDevice,
} from '@/entities/connected-device';
import { useCommandPoller, type Command } from '@/entities/command';
import { getCommandErrorMessageKey, useErrorMessage, useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useToast } from '@/shared/ui';

/** `sending`: request/command running; `waiting`: command `UNKNOWN` or polling gave up (not an error). */
export type RemovePhase = 'idle' | 'sending' | 'waiting';

export interface UseRemoveConnectedDevice {
  phase: RemovePhase;
  isSelf: boolean;
  confirmOpen: boolean;
  open: () => void;
  close: () => void;
  confirm: () => void;
}

/**
 * P4-03 "Xoá thiết bị khỏi kết nối" (assumption G-10/M-15: block Internet, then hide). DELETE →
 * Command → poll; on CONFIRMED the device leaves every cached list and `onRemoved` runs.
 */
export function useRemoveConnectedDevice(
  serialNumber: string,
  device: ConnectedDevice,
  onRemoved: () => void,
): UseRemoveConnectedDevice {
  const { t } = useTranslation('devices');
  const { t: tErrors } = useTranslation('errors');
  const toMessage = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();
  const { identity } = useSelfDeviceIdentity();
  const remove = useRemoveConnectedDeviceMutation(serialNumber);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [command, setCommand] = useState<Command | null>(null);
  const name = device.name ?? t('unnamed');
  const macAddress = device.macAddress;

  const onSettled = useCallback(
    (settled: Command) => {
      setRunning(false);
      setCommand(null);
      setConfirmOpen(false);
      keys.renew();
      if (settled.state === 'CONFIRMED') {
        removeConnectedDeviceFromCache(queryClient, serialNumber, macAddress);
        void queryClient.invalidateQueries({
          queryKey: [...connectedDeviceKeys.all(serialNumber), 'list'],
        });
        toast.show(t('remove.removed', { name }));
        onRemoved();
      } else {
        toast.show(tErrors(getCommandErrorMessageKey(settled.errorCode)), { tone: 'danger' });
      }
    },
    [keys, macAddress, name, onRemoved, queryClient, serialNumber, t, tErrors, toast],
  );

  const poll = useCommandPoller(command?.commandId ?? null, {
    type: command?.type,
    initialCommand: command,
    onSettled,
  });

  let phase: RemovePhase = 'idle';
  if (running) {
    phase =
      poll.status === 'timeout' || (poll.status === 'polling' && poll.command?.state === 'UNKNOWN')
        ? 'waiting'
        : 'sending';
  }

  return {
    phase,
    isSelf: isSelfDevice(device, identity),
    // The dialog closes by itself once the modem answers UNKNOWN; the row shows the waiting note.
    confirmOpen: confirmOpen && phase !== 'waiting',
    // Still sending or UNKNOWN: the row shows the pending message; do not start a second command.
    open: () => {
      if (phase === 'idle') setConfirmOpen(true);
    },
    close: () => {
      if (phase !== 'sending') setConfirmOpen(false);
    },
    confirm: () => {
      if (running) return;
      setRunning(true);
      remove.mutate(
        { macAddress, idempotencyKey: keys.forAction({ macAddress, identity }), ...identity },
        {
          onSuccess: setCommand,
          onError: (error) => {
            setRunning(false);
            setConfirmOpen(false);
            toast.show(toMessage(error), { tone: 'danger' });
          },
        },
      );
    },
  };
}
