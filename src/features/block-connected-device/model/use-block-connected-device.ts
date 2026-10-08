import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import {
  connectedDeviceKeys,
  isSelfDevice,
  patchConnectedDeviceInCache,
  useBlockConnectedDeviceMutation,
  useSelfDeviceIdentity,
  useUnblockConnectedDeviceMutation,
  writeConnectedDeviceToCache,
  type ConnectedDevice,
} from '@/entities/connected-device';
import { useCommandPoller, type Command } from '@/entities/command';
import { getCommandErrorMessageKey, useErrorMessage, useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useToast } from '@/shared/ui';

type BlockAction = 'BLOCK' | 'UNBLOCK';

/**
 * - `sending`: request in flight or the modem has not answered yet (switch busy).
 * - `waiting`: command is `UNKNOWN` or polling gave up — not an error (CF §2.4); result comes later.
 */
export type BlockPhase = 'idle' | 'sending' | 'waiting';

export interface UseBlockConnectedDevice {
  /** Switch value: the optimistic target while a command runs, else `status === 'BLOCKED'`. */
  checked: boolean;
  phase: BlockPhase;
  /** The phone running the MiniApp must not block itself (Q-46). */
  isSelf: boolean;
  confirmOpen: boolean;
  /** Switch handler: blocking asks for confirmation first (M-11), unblocking runs at once. */
  requestChange: (blocked: boolean) => void;
  confirmBlock: () => void;
  cancelConfirm: () => void;
}

/** P4-02 block/unblock: optimistic status, 202 → commandPoller, rollback on FAILED. */
export function useBlockConnectedDevice(
  serialNumber: string,
  device: ConnectedDevice,
): UseBlockConnectedDevice {
  const { t } = useTranslation('devices');
  const { t: tErrors } = useTranslation('errors');
  const toMessage = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();
  const { identity } = useSelfDeviceIdentity();
  const block = useBlockConnectedDeviceMutation(serialNumber);
  const unblock = useUnblockConnectedDeviceMutation(serialNumber);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [target, setTarget] = useState<BlockAction | null>(null);
  const [command, setCommand] = useState<Command | null>(null);
  const previousRef = useRef<ConnectedDevice | undefined>(undefined);
  const actionRef = useRef<BlockAction>('BLOCK');
  const name = device.name ?? t('unnamed');

  const rollback = useCallback(() => {
    if (previousRef.current) writeConnectedDeviceToCache(queryClient, serialNumber, previousRef.current);
    previousRef.current = undefined;
  }, [queryClient, serialNumber]);

  const finish = useCallback(() => {
    setTarget(null);
    setCommand(null);
    keys.renew();
  }, [keys]);

  const onSettled = useCallback(
    (settled: Command) => {
      if (settled.state === 'CONFIRMED') {
        toast.show(t(actionRef.current === 'UNBLOCK' ? 'block.unblocked' : 'block.blocked', { name }));
        previousRef.current = undefined;
      } else {
        rollback();
        toast.show(tErrors(getCommandErrorMessageKey(settled.errorCode)), { tone: 'danger' });
      }
      finish();
      void queryClient.invalidateQueries({ queryKey: connectedDeviceKeys.all(serialNumber) });
    },
    [finish, name, queryClient, rollback, serialNumber, t, tErrors, toast],
  );

  const poll = useCommandPoller(command?.commandId ?? null, {
    type: command?.type,
    initialCommand: command,
    onSettled,
  });

  const start = (action: BlockAction) => {
    const macAddress = device.macAddress;
    actionRef.current = action;
    setTarget(action);
    // The list polls every 30s: an in-flight refetch must not overwrite the optimistic status.
    void queryClient.cancelQueries({ queryKey: connectedDeviceKeys.all(serialNumber) });
    previousRef.current = patchConnectedDeviceInCache(queryClient, serialNumber, macAddress, {
      status: action === 'BLOCK' ? 'BLOCKED' : 'DISCONNECTED',
    });
    const handlers = {
      onSuccess: (next: Command) => setCommand(next),
      onError: (error: unknown) => {
        rollback();
        setTarget(null);
        toast.show(toMessage(error), { tone: 'danger' });
      },
    };
    if (action === 'BLOCK') {
      block.mutate(
        { macAddress, idempotencyKey: keys.forAction({ action, macAddress, identity }), ...identity },
        handlers,
      );
    } else {
      unblock.mutate({ macAddress, idempotencyKey: keys.forAction({ action, macAddress }) }, handlers);
    }
  };

  let phase: BlockPhase = 'idle';
  if (target !== null) {
    phase =
      poll.status === 'timeout' || (poll.status === 'polling' && poll.command?.state === 'UNKNOWN')
        ? 'waiting'
        : 'sending';
  }

  return {
    checked: target !== null ? target === 'BLOCK' : device.status === 'BLOCKED',
    phase,
    isSelf: isSelfDevice(device, identity),
    confirmOpen,
    // One command at a time: while one is sending or UNKNOWN, a second change would overwrite the
    // rollback snapshot and stop tracking the first. The card shows the pending message instead.
    requestChange: (blocked) => {
      if (phase !== 'idle') return;
      if (blocked) setConfirmOpen(true);
      else start('UNBLOCK');
    },
    confirmBlock: () => {
      setConfirmOpen(false);
      if (phase !== 'idle') return;
      start('BLOCK');
    },
    cancelConfirm: () => setConfirmOpen(false),
  };
}
