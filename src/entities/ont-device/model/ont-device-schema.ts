import { z } from 'zod';
import type { AcceptsContract, ApiSchemas } from '@/shared/api';

/** ONT information, 7 fields (P5-01, MD-02); missing sources are `null` → UI shows "—". */
export const ontDeviceSchema = z.object({
  serialNumber: z.string().min(1),
  modelName: z.string().nullable().optional(),
  displayName: z.string(),
  macAddress: z.string().nullable().optional(),
  wanIpAddress: z.string().nullable().optional(),
  firmwareVersion: z.string().nullable().optional(),
  uptimeSec: z.number().int().nonnegative().nullable().optional(),
  totalTrafficBytes: z.number().nonnegative().nullable().optional(),
  temperatureCelsius: z.number().nullable().optional(),
});

/** MD-03 (proposed): 1–32 characters. */
export const renameOntDeviceInputSchema = z.object({
  displayName: z.string().trim().min(1).max(32),
});

void (true satisfies AcceptsContract<typeof ontDeviceSchema, ApiSchemas['Device']>);

export type OntDevice = z.infer<typeof ontDeviceSchema>;
export type RenameOntDeviceInput = z.infer<typeof renameOntDeviceInputSchema>;

/** Partial-error targets of `GET /mesh/v1/devices/{serialNumber}`. */
export const ONT_DEVICE_ERROR_TARGETS = ['info', 'wan', 'optical', 'traffic'] as const;

export type OntDeviceErrorTarget = (typeof ONT_DEVICE_ERROR_TARGETS)[number];

/** Which partial-error target feeds each optional field (P5-01: info, WAN, optical, traffic). */
export const ONT_DEVICE_FIELD_TARGETS = {
  macAddress: 'info',
  firmwareVersion: 'info',
  uptimeSec: 'info',
  wanIpAddress: 'wan',
  temperatureCelsius: 'optical',
  totalTrafficBytes: 'traffic',
} as const satisfies Partial<Record<keyof OntDevice, OntDeviceErrorTarget>>;

export const BYTES_PER_GB = 1024 ** 3;

export function bytesToGb(bytes: number | null | undefined): number | null {
  return bytes === null || bytes === undefined ? null : bytes / BYTES_PER_GB;
}
