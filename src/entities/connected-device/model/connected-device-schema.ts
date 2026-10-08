import { z } from 'zod';
import type { AcceptsContract, ApiSchemas } from '@/shared/api';

export const connectedDeviceStatusSchema = z.enum(['CONNECTED', 'DISCONNECTED', 'BLOCKED']);
export const deviceIconSchema = z.enum([
  'PHONE',
  'TABLET',
  'LAPTOP',
  'TV',
  'ROUTER',
  'STORAGE',
  'MESH',
  'CAMERA',
]);
export const connectedDeviceKindSchema = z.enum(['MESH', 'AP', 'CLIENT']);

/** Device seen by the modem (P4-01). */
export const connectedDeviceSchema = z.object({
  macAddress: z.string().min(1),
  // R-02: LLD §8.2 allows `null` (custom name → hostName → deviceName → null) although the
  // contract says string. Tolerate it; the UI shows "Thiết bị không tên" + MAC.
  name: z.string().nullable(),
  icon: deviceIconSchema.optional(),
  kind: connectedDeviceKindSchema,
  status: connectedDeviceStatusSchema,
  connectionType: z.enum(['WIRED', 'WIRELESS']).nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  wifiSsid: z.string().nullable().optional(),
  blockable: z.boolean(),
  trafficSharePercent: z.number().int().min(0).max(100).nullable().optional(),
});

export const connectedDeviceListSchema = z.array(connectedDeviceSchema);

/** TB-07: name up to 32 chars, empty/null clears the custom name. */
export const updateConnectedDeviceInputSchema = z
  .object({
    name: z.string().trim().max(32).nullable().optional(),
    icon: deviceIconSchema.optional(),
  })
  .refine((input) => input.name !== undefined || input.icon !== undefined, {
    message: 'Provide a name or an icon.',
  });

void (true satisfies AcceptsContract<typeof connectedDeviceSchema, ApiSchemas['ConnectedDevice']>);

export type ConnectedDevice = z.infer<typeof connectedDeviceSchema>;
export type ConnectedDeviceStatus = z.infer<typeof connectedDeviceStatusSchema>;
export type DeviceIcon = z.infer<typeof deviceIconSchema>;
export type UpdateConnectedDeviceInput = z.infer<typeof updateConnectedDeviceInputSchema>;

/** The phone running the MiniApp (from bridge `getWifiInfo`); it must not block/remove itself (Q-46). */
export interface SelfDeviceIdentity {
  selfMacAddress: string | null;
  selfIpAddress: string | null;
}

/** Partial-error targets of the list endpoint. */
export const CONNECTED_DEVICE_ERROR_TARGETS = ['blockList', 'fingerprint', 'topology'] as const;

/** MACs are upper-case and colon separated (LLD §8.2). */
export function normalizeMac(mac: string): string {
  return mac.trim().toUpperCase().replace(/-/g, ':');
}

/** Filter chips: "Tất cả" = all; "Đang kết nối" = CONNECTED; "Đang bị chặn" = BLOCKED. */
export type ConnectedDeviceFilter = 'ALL' | 'CONNECTED' | 'BLOCKED';

export function filterConnectedDevices(
  devices: ConnectedDevice[],
  filter: ConnectedDeviceFilter,
): ConnectedDevice[] {
  return filter === 'ALL' ? devices : devices.filter((device) => device.status === filter);
}

export function countConnectedDevices(devices: ConnectedDevice[]): Record<ConnectedDeviceFilter, number> {
  return {
    ALL: devices.length,
    CONNECTED: devices.filter((device) => device.status === 'CONNECTED').length,
    BLOCKED: devices.filter((device) => device.status === 'BLOCKED').length,
  };
}
