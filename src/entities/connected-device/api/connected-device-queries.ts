import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IdempotentVariables, WithMeta } from '@/shared/api';
import type {
  ConnectedDevice,
  ConnectedDeviceStatus,
  SelfDeviceIdentity,
  UpdateConnectedDeviceInput,
} from '../model/connected-device-schema';
import { connectedDeviceApi } from './connected-device-api';
import { findCachedConnectedDevice, writeConnectedDeviceToCache } from './connected-device-cache';
import { connectedDeviceKeys } from './connected-device-keys';

export { connectedDeviceKeys };

/** Server keeps the list in cache for 1 minute (LLD §8.2); the tab refetches every 30s while visible. */
export const CONNECTED_DEVICES_POLL_MS = 30_000;

export interface ConnectedDevicesQueryOptions {
  /** Poll interval; TanStack pauses it while the page is hidden (`refetchIntervalInBackground: false`). */
  refetchInterval?: number | false;
}

/** Filtering is done client-side on the full list (LLD §8.2); `status` is optional. */
export function useConnectedDevicesQuery(
  serialNumber: string | null,
  status?: ConnectedDeviceStatus,
  { refetchInterval = false }: ConnectedDevicesQueryOptions = {},
) {
  return useQuery({
    queryKey: connectedDeviceKeys.list(serialNumber ?? '', status),
    queryFn: ({ signal }) => connectedDeviceApi.list(serialNumber!, status, signal),
    enabled: serialNumber !== null,
    refetchInterval,
  });
}

/** Detail of one device; shows the row from the list cache while the request runs (LLD §8.1). */
export function useConnectedDeviceQuery(serialNumber: string | null, macAddress: string | null) {
  const queryClient = useQueryClient();
  const cached =
    serialNumber !== null && macAddress !== null
      ? findCachedConnectedDevice(queryClient, serialNumber, macAddress)
      : undefined;
  const placeholder: WithMeta<ConnectedDevice> | undefined = cached
    ? { data: cached, meta: null, errors: [] }
    : undefined;
  return useQuery({
    queryKey: connectedDeviceKeys.detail(serialNumber ?? '', macAddress ?? ''),
    queryFn: ({ signal }) => connectedDeviceApi.detail(serialNumber!, macAddress!, signal),
    enabled: serialNumber !== null && macAddress !== null,
    placeholderData: placeholder,
  });
}

export type UpdateConnectedDeviceVariables = UpdateConnectedDeviceInput &
  IdempotentVariables & { macAddress: string };

/** Name/icon are stored by MyHome (TB-07): the response is final, so list + detail caches are written. */
export function useUpdateConnectedDeviceMutation(serialNumber: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ macAddress, idempotencyKey, ...input }: UpdateConnectedDeviceVariables) =>
      connectedDeviceApi.update(serialNumber, macAddress, input, idempotencyKey),
    onSuccess: (device) => {
      writeConnectedDeviceToCache(queryClient, serialNumber, device);
    },
  });
}

export type ConnectedDeviceCommandVariables = IdempotentVariables & {
  macAddress: string;
} & SelfDeviceIdentity;

/** Returns the Command; poll it, then invalidate `connectedDeviceKeys.all(serialNumber)`. */
export function useBlockConnectedDeviceMutation(serialNumber: string) {
  return useMutation({
    mutationFn: ({
      macAddress,
      idempotencyKey,
      selfMacAddress,
      selfIpAddress,
    }: ConnectedDeviceCommandVariables) =>
      connectedDeviceApi.block(serialNumber, macAddress, { selfMacAddress, selfIpAddress }, idempotencyKey),
  });
}

export function useUnblockConnectedDeviceMutation(serialNumber: string) {
  return useMutation({
    mutationFn: ({ macAddress, idempotencyKey }: IdempotentVariables & { macAddress: string }) =>
      connectedDeviceApi.unblock(serialNumber, macAddress, idempotencyKey),
  });
}

export function useRemoveConnectedDeviceMutation(serialNumber: string) {
  return useMutation({
    mutationFn: ({
      macAddress,
      idempotencyKey,
      selfMacAddress,
      selfIpAddress,
    }: ConnectedDeviceCommandVariables) =>
      connectedDeviceApi.remove(serialNumber, macAddress, { selfMacAddress, selfIpAddress }, idempotencyKey),
  });
}
