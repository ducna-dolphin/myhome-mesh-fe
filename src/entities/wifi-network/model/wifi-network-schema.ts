import { z } from 'zod';
import type { AcceptsContract, ApiSchemas } from '@/shared/api';

export const wifiBandSchema = z.enum(['BAND_2_4GHZ', 'BAND_5GHZ']);

/** Wi-Fi network of the modem, without password (P3-01, CF §2.1). */
export const wifiNetworkSchema = z.object({
  wifiIndex: z.number().int().nonnegative(),
  ssid: z.string(),
  band: wifiBandSchema,
  enabled: z.boolean(),
  securityMode: z.string().nullable().optional(),
});

export const wifiNetworkListSchema = z.array(wifiNetworkSchema);

/** Password revealed on demand; keep only in screen memory (LLD §11.5: clear after 60s or on leave). */
export const wifiPasswordSchema = z.object({
  wifiIndex: z.number().int().nonnegative(),
  ssid: z.string(),
  password: z.string(),
  securityMode: z.string().nullable().optional(),
});

export const wifiPasswordPurposeSchema = z.enum(['VIEW', 'COPY', 'QR']);

/** JSON Merge Patch body (P3-02, WF-05). At least one field. */
export const wifiNetworkPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    ssid: z.string().min(1).max(32).optional(),
    password: z.string().min(8).max(63).optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: 'At least one field is required.',
  });

void (true satisfies AcceptsContract<typeof wifiNetworkSchema, ApiSchemas['WifiNetwork']>);
void (true satisfies AcceptsContract<typeof wifiPasswordSchema, ApiSchemas['WifiPassword']>);

export type WifiBand = z.infer<typeof wifiBandSchema>;
export type WifiNetwork = z.infer<typeof wifiNetworkSchema>;
export type WifiPassword = z.infer<typeof wifiPasswordSchema>;
export type WifiPasswordPurpose = z.infer<typeof wifiPasswordPurposeSchema>;
export type WifiNetworkPatch = z.infer<typeof wifiNetworkPatchSchema>;

function escapeWifiQrValue(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

/** QR payload `WIFI:T:WPA;S:<ssid>;P:<password>;;` with `\ ; , : "` escaped (P3-01, WF-07). */
export function buildWifiQrPayload({
  ssid,
  password,
  securityMode,
}: Pick<WifiPassword, 'ssid' | 'password' | 'securityMode'>) {
  const open = securityMode?.toUpperCase() === 'NONE' || securityMode?.toUpperCase() === 'OPEN';
  const type = open ? 'nopass' : securityMode?.toUpperCase().includes('WEP') ? 'WEP' : 'WPA';
  const passwordPart = open ? '' : `P:${escapeWifiQrValue(password)};`;
  return `WIFI:T:${type};S:${escapeWifiQrValue(ssid)};${passwordPart};`;
}
