import type { QueryClient } from '@tanstack/react-query';
import type { WithMeta } from '@/shared/api';
import { normalizeMac, type ConnectedDevice } from '../model/connected-device-schema';
import { connectedDeviceKeys } from './connected-device-keys';

const listPrefix = (serialNumber: string) => [...connectedDeviceKeys.all(serialNumber), 'list'] as const;

/** Finds a device in any cached list of the modem (detail reuses the list cache, LLD §8.1). */
export function findCachedConnectedDevice(
  queryClient: QueryClient,
  serialNumber: string,
  macAddress: string,
): ConnectedDevice | undefined {
  const mac = normalizeMac(macAddress);
  for (const [, list] of queryClient.getQueriesData<WithMeta<ConnectedDevice[]>>({
    queryKey: listPrefix(serialNumber),
  })) {
    const device = list?.data.find((item) => normalizeMac(item.macAddress) === mac);
    if (device) return device;
  }
  return undefined;
}

/** Writes a device into the detail cache and every list cache that contains it. */
export function writeConnectedDeviceToCache(
  queryClient: QueryClient,
  serialNumber: string,
  device: ConnectedDevice,
): void {
  const mac = normalizeMac(device.macAddress);
  queryClient.setQueryData<WithMeta<ConnectedDevice>>(
    connectedDeviceKeys.detail(serialNumber, mac),
    (current) => (current ? { ...current, data: device } : current),
  );
  queryClient.setQueriesData<WithMeta<ConnectedDevice[]>>(
    { queryKey: listPrefix(serialNumber) },
    (current) =>
      current
        ? {
            ...current,
            data: current.data.map((item) => (normalizeMac(item.macAddress) === mac ? device : item)),
          }
        : current,
  );
}

/**
 * Patches a device in detail + list caches (optimistic block/unblock). Returns the device as it was
 * before, for rollback, or `undefined` when nothing was cached.
 */
export function patchConnectedDeviceInCache(
  queryClient: QueryClient,
  serialNumber: string,
  macAddress: string,
  patch: Partial<ConnectedDevice>,
): ConnectedDevice | undefined {
  const mac = normalizeMac(macAddress);
  const previous =
    queryClient.getQueryData<WithMeta<ConnectedDevice>>(connectedDeviceKeys.detail(serialNumber, mac))
      ?.data ?? findCachedConnectedDevice(queryClient, serialNumber, mac);
  if (!previous) return undefined;
  writeConnectedDeviceToCache(queryClient, serialNumber, { ...previous, ...patch });
  return previous;
}

/** Drops a removed device from every list cache and forgets its detail (P4-03). */
export function removeConnectedDeviceFromCache(
  queryClient: QueryClient,
  serialNumber: string,
  macAddress: string,
): void {
  const mac = normalizeMac(macAddress);
  queryClient.setQueriesData<WithMeta<ConnectedDevice[]>>(
    { queryKey: listPrefix(serialNumber) },
    (current) =>
      current
        ? { ...current, data: current.data.filter((item) => normalizeMac(item.macAddress) !== mac) }
        : current,
  );
  queryClient.removeQueries({ queryKey: connectedDeviceKeys.detail(serialNumber, mac), exact: true });
}
