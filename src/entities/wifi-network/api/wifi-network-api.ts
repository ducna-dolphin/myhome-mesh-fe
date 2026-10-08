import { apiRequest, commandSchema, type Command, type WithMeta } from '@/shared/api';
import {
  wifiNetworkListSchema,
  wifiPasswordSchema,
  type WifiNetwork,
  type WifiNetworkPatch,
  type WifiPassword,
  type WifiPasswordPurpose,
} from '../model/wifi-network-schema';

const networksPath = (serialNumber: string) =>
  `/mesh/v1/devices/${encodeURIComponent(serialNumber)}/wifi-networks`;

export const wifiNetworkApi = {
  /** `GET …/wifi-networks` (P3-01). */
  async list(serialNumber: string, signal?: AbortSignal): Promise<WithMeta<WifiNetwork[]>> {
    const { data, meta, errors } = await apiRequest({
      path: networksPath(serialNumber),
      schema: wifiNetworkListSchema,
      signal,
    });
    return { data, meta, errors };
  },

  /** `POST …/wifi-networks/{wifiIndex}/reveal-password` — no idempotency key, never cached. */
  async revealPassword(
    serialNumber: string,
    wifiIndex: number,
    purpose: WifiPasswordPurpose,
    signal?: AbortSignal,
  ): Promise<WifiPassword> {
    const { data } = await apiRequest({
      path: `${networksPath(serialNumber)}/${wifiIndex}/reveal-password`,
      method: 'POST',
      schema: wifiPasswordSchema,
      body: { purpose },
      signal,
    });
    return data;
  },

  /** `PATCH …/wifi-networks/{wifiIndex}` as JSON Merge Patch → 202 Command (P3-02). */
  async update(
    serialNumber: string,
    wifiIndex: number,
    patch: WifiNetworkPatch,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<Command> {
    const { data } = await apiRequest({
      path: `${networksPath(serialNumber)}/${wifiIndex}`,
      method: 'PATCH',
      contentType: 'application/merge-patch+json',
      schema: commandSchema,
      body: patch,
      idempotencyKey,
      signal,
    });
    return data;
  },
};
