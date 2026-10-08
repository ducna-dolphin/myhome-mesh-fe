import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useCommandPoller, type Command } from '@/entities/command';
import { wifiNetworkKeys, type PendingWifiCommand, type PendingWifiCommands } from '@/entities/wifi-network';
import { getCommandErrorMessageKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useToast } from '@/shared/ui';

interface WifiCommandWatcherProps {
  serialNumber: string;
  entry: PendingWifiCommand;
  /** SSID shown to the user (before the change). */
  ssid: string;
  /** The server list already shows the requested values (applied while we were not polling). */
  applied: boolean;
  tracker: PendingWifiCommands;
}

/**
 * Polls one in-flight Wi-Fi command (P0-04) for the list. CONFIRMED → refetch + toast;
 * FAILED → drop the optimistic value (rollback) + toast the mapped `errorCode`;
 * UNKNOWN / poll timeout → keep the optimistic value and say the request is awaiting the modem.
 * Renders nothing.
 */
export function WifiCommandWatcher({ serialNumber, entry, ssid, applied, tracker }: WifiCommandWatcherProps) {
  const { t } = useTranslation('wifi');
  const { t: tErrors } = useTranslation('errors');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { commandId, patch } = entry;
  const { settle, markAwaitingConfirmation } = tracker;

  const refetchList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: wifiNetworkKeys.list(serialNumber) }),
    [queryClient, serialNumber],
  );

  const onSettled = useCallback(
    (command: Command) => {
      settle(command.commandId);
      void refetchList();
      if (command.state === 'CONFIRMED') {
        if (patch.enabled !== undefined) {
          toast.show(t(patch.enabled ? 'toggle.turnedOn' : 'toggle.turnedOff', { ssid: patch.ssid ?? ssid }));
        } else {
          toast.show(t('edit.saved'));
        }
        return;
      }
      toast.show(
        t('command.failed', { ssid, reason: tErrors(getCommandErrorMessageKey(command.errorCode)) }),
        { tone: 'danger' },
      );
    },
    [patch.enabled, patch.ssid, refetchList, settle, ssid, t, tErrors, toast],
  );

  const { command, isTimedOut } = useCommandPoller(commandId, {
    type: 'WIFI_UPDATE',
    initialCommand: entry.command,
    onSettled,
  });

  const unconfirmed = command?.state === 'UNKNOWN' || isTimedOut;

  useEffect(() => {
    if (!unconfirmed || entry.awaitingConfirmation) return;
    markAwaitingConfirmation(commandId);
    toast.show(t('command.sent'));
    if (isTimedOut) void refetchList();
  }, [
    commandId,
    entry.awaitingConfirmation,
    isTimedOut,
    markAwaitingConfirmation,
    refetchList,
    t,
    toast,
    unconfirmed,
  ]);

  // Awaiting confirmation and the modem already reports the new values: nothing left to show.
  useEffect(() => {
    if (entry.awaitingConfirmation && applied) settle(commandId);
  }, [applied, commandId, entry.awaitingConfirmation, settle]);

  return null;
}
