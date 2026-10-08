import { useQuery } from '@tanstack/react-query';
import { useSuperApp } from '@/shared/super-app';
import type { SelfDeviceIdentity } from '../model/connected-device-schema';

const NO_IDENTITY: SelfDeviceIdentity = { selfMacAddress: null, selfIpAddress: null };

export const selfDeviceIdentityKey = ['bridge', 'wifi-info', 'self-device'] as const;

export interface SelfDeviceIdentityResult {
  /** `{ null, null }` when the bridge does not support `getWifiInfo` or the call fails. */
  identity: SelfDeviceIdentity;
  isLoading: boolean;
}

/**
 * MAC/IP of the phone running the MiniApp, from bridge `getWifiInfo` (S-03). Sent with block/remove
 * so the backend can refuse self-blocking (Q-46), and used to disable the controls up front.
 */
export function useSelfDeviceIdentity(): SelfDeviceIdentityResult {
  const superApp = useSuperApp();
  const query = useQuery({
    queryKey: selfDeviceIdentityKey,
    queryFn: async (): Promise<SelfDeviceIdentity> => {
      if (!superApp.supports('getWifiInfo')) return NO_IDENTITY;
      try {
        const info = await superApp.getWifiInfo();
        return { selfMacAddress: info.macAddress ?? null, selfIpAddress: info.ipAddress ?? null };
      } catch {
        // Missing permission / old host: the backend still guards with 409 DEVICE_NOT_BLOCKABLE.
        return NO_IDENTITY;
      }
    },
    staleTime: 30_000,
    retry: false,
  });
  return { identity: query.data ?? NO_IDENTITY, isLoading: query.isPending };
}
