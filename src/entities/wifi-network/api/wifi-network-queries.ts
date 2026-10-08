import { useMutation, useQuery } from '@tanstack/react-query';
import type { IdempotentVariables } from '@/shared/api';
import { deviceScope } from '@/shared/lib';
import type { WifiNetworkPatch, WifiPasswordPurpose } from '../model/wifi-network-schema';
import { wifiNetworkApi } from './wifi-network-api';

export const wifiNetworkKeys = {
  list: (serialNumber: string) => [...deviceScope(serialNumber), 'wifi-networks'] as const,
};

export function useWifiNetworksQuery(serialNumber: string | null) {
  return useQuery({
    queryKey: wifiNetworkKeys.list(serialNumber ?? ''),
    queryFn: ({ signal }) => wifiNetworkApi.list(serialNumber!, signal),
    enabled: serialNumber !== null,
  });
}

export interface RevealWifiPasswordVariables {
  wifiIndex: number;
  purpose: WifiPasswordPurpose;
}

/**
 * Reveals a Wi-Fi password for view/copy/QR. A mutation (POST, never deduplicated) with
 * `gcTime: 0` so the password is dropped from the cache as soon as no component uses it.
 */
export function useRevealWifiPasswordMutation(serialNumber: string) {
  return useMutation({
    mutationFn: ({ wifiIndex, purpose }: RevealWifiPasswordVariables) =>
      wifiNetworkApi.revealPassword(serialNumber, wifiIndex, purpose),
    gcTime: 0,
  });
}

export interface UpdateWifiNetworkVariables extends IdempotentVariables {
  wifiIndex: number;
  patch: WifiNetworkPatch;
}

/**
 * Returns the write Command (202). Track it with `useCommandPoller`; `UNKNOWN` is expected when the
 * phone is on the network being changed. Refetch the list when the command settles.
 *
 * `gcTime: 0`: the variables may carry the new password (LLD §11.5), so the mutation leaves the
 * cache as soon as it has no observer. Callers `reset()` it once settled.
 */
export function useUpdateWifiNetworkMutation(serialNumber: string) {
  return useMutation({
    mutationFn: ({ wifiIndex, patch, idempotencyKey }: UpdateWifiNetworkVariables) =>
      wifiNetworkApi.update(serialNumber, wifiIndex, patch, idempotencyKey),
    gcTime: 0,
  });
}
