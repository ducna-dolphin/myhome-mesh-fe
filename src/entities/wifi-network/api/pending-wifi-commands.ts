import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { Command } from '@/shared/api';
import { deviceScope } from '@/shared/lib';
import type { WifiNetwork, WifiNetworkPatch } from '../model/wifi-network-schema';

/**
 * A Wi-Fi write command (P3-02) the user started in this session and that has not been confirmed
 * yet. Kept in the QueryClient (not in a component) so tracking survives closing the options sheet
 * or leaving the edit page: the list keeps showing "applying" and the optimistic value.
 */
export interface PendingWifiCommand {
  wifiIndex: number;
  commandId: string;
  /** Command returned by the PATCH (202); seeds the poller. */
  command: Command;
  /** Visible fields the command changes; overlaid on the list (optimistic UI). Never the password. */
  patch: Pick<WifiNetworkPatch, 'enabled' | 'ssid'>;
  /**
   * The modem has not confirmed in time (`UNKNOWN` or poll timeout). Not a failure (CF §2.4): the
   * optimistic value stays and the UI says the request was sent and awaits confirmation.
   */
  awaitingConfirmation: boolean;
}

/** Outside `wifiNetworkKeys.list` so invalidating the list does not refetch this local-only entry. */
export const pendingWifiCommandsKey = (serialNumber: string) =>
  [...deviceScope(serialNumber), 'wifi-pending-commands'] as const;

const EMPTY: PendingWifiCommand[] = [];

export interface PendingWifiCommands {
  pending: PendingWifiCommand[];
  /** Entry of a network, if a command for it is in flight. */
  forNetwork: (wifiIndex: number) => PendingWifiCommand | undefined;
  /** Adds (or replaces) the in-flight command of a network. */
  track: (entry: Omit<PendingWifiCommand, 'awaitingConfirmation' | 'commandId'>) => void;
  markAwaitingConfirmation: (commandId: string) => void;
  /** Drops the entry (confirmed, failed → rollback, or superseded). */
  settle: (commandId: string) => void;
}

export function usePendingWifiCommands(serialNumber: string): PendingWifiCommands {
  const queryClient = useQueryClient();
  const key = useMemo(() => pendingWifiCommandsKey(serialNumber), [serialNumber]);
  const { data = EMPTY } = useQuery({
    queryKey: key,
    // Local state only: return what is already in the cache, never hit the network.
    queryFn: () => queryClient.getQueryData<PendingWifiCommand[]>(key) ?? EMPTY,
    initialData: EMPTY,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const update = useCallback(
    (updater: (current: PendingWifiCommand[]) => PendingWifiCommand[]) =>
      queryClient.setQueryData<PendingWifiCommand[]>(key, (current) => updater(current ?? EMPTY)),
    [key, queryClient],
  );

  const track = useCallback<PendingWifiCommands['track']>(
    (entry) =>
      update((current) => [
        ...current.filter((item) => item.wifiIndex !== entry.wifiIndex),
        { ...entry, commandId: entry.command.commandId, awaitingConfirmation: false },
      ]),
    [update],
  );

  const markAwaitingConfirmation = useCallback(
    (commandId: string) =>
      update((current) =>
        current.map((item) =>
          item.commandId === commandId && !item.awaitingConfirmation
            ? { ...item, awaitingConfirmation: true }
            : item,
        ),
      ),
    [update],
  );

  const settle = useCallback(
    (commandId: string) => update((current) => current.filter((item) => item.commandId !== commandId)),
    [update],
  );

  const forNetwork = useCallback(
    (wifiIndex: number) => data.find((item) => item.wifiIndex === wifiIndex),
    [data],
  );

  return useMemo(
    () => ({ pending: data, forNetwork, track, markAwaitingConfirmation, settle }),
    [data, forNetwork, track, markAwaitingConfirmation, settle],
  );
}

/** Network as the user expects it: server data with the in-flight command's values on top. */
export function applyPendingWifiCommand(
  network: WifiNetwork,
  pending: PendingWifiCommand | undefined,
): WifiNetwork {
  if (!pending) return network;
  return {
    ...network,
    ...(pending.patch.enabled !== undefined ? { enabled: pending.patch.enabled } : {}),
    ...(pending.patch.ssid !== undefined ? { ssid: pending.patch.ssid } : {}),
  };
}
