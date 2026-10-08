import { z } from 'zod';
import type { AcceptsContract, ApiSchemas } from '@/shared/api';

export const healthCheckStateSchema = z.enum(['PENDING', 'RUNNING', 'DONE', 'FAILED']);
export const healthCheckItemTypeSchema = z.enum(['INTERNET_LINE', 'WIFI_SIGNAL', 'CONNECTED_DEVICES']);
export const healthCheckItemStatusSchema = z.enum([
  'STABLE',
  'UNSTABLE',
  'DISCONNECTED',
  'PASS',
  'FAIL',
  'OFF',
  'NORMAL',
  'HOGGED',
]);
export const healthCheckActionSchema = z.enum([
  'RESET_MODEM',
  'REPORT_FAULT',
  'ENABLE_WIFI',
  'ORDER_MESH',
  'OPEN_DEVICES_TAB',
]);

/** One check item; the UI composes copy from `status` and the numbers (SRC-HEALTH-SCRIPT §3). */
export const healthCheckItemSchema = z.object({
  itemType: healthCheckItemTypeSchema,
  state: healthCheckStateSchema,
  status: healthCheckItemStatusSchema.nullable().optional(),
  action: healthCheckActionSchema.nullable().optional(),
  dropCount: z.number().int().nonnegative().nullable().optional(),
  activeDeviceCount: z.number().int().nonnegative().nullable().optional(),
  topDevice: z
    .object({
      macAddress: z.string().optional(),
      name: z.string().nullable().optional(),
      sharePercent: z.number().int().min(0).max(100).optional(),
    })
    .nullable()
    .optional(),
  errorCode: z.string().nullable().optional(),
});

/** Line-quality check run (P6-01). */
export const healthCheckSchema = z.object({
  checkId: z.string().min(1),
  state: healthCheckStateSchema,
  overallStatus: z.enum(['NO_ISSUE', 'ISSUES_FOUND', 'INCOMPLETE']).nullable().optional(),
  issueCount: z.number().int().nonnegative().nullable().optional(),
  items: z.array(healthCheckItemSchema),
  createdAt: z.string().optional(),
  finishedAt: z.string().nullable().optional(),
});

export const healthCheckListSchema = z.array(healthCheckSchema);

export const faultReportSchema = z.object({
  ticketCode: z.string().min(1),
  createdAt: z.string().optional(),
});

void (true satisfies AcceptsContract<typeof healthCheckSchema, ApiSchemas['HealthCheck']>);

export type HealthCheck = z.infer<typeof healthCheckSchema>;
export type HealthCheckItem = z.infer<typeof healthCheckItemSchema>;
export type HealthCheckState = z.infer<typeof healthCheckStateSchema>;
export type HealthCheckItemType = z.infer<typeof healthCheckItemTypeSchema>;
export type HealthCheckAction = z.infer<typeof healthCheckActionSchema>;
export type FaultReport = z.infer<typeof faultReportSchema>;

/** Polling cadence and limit (P6-01: every 3s; a run over 3 minutes counts as failed). */
export const HEALTH_CHECK_POLL_MS = 3_000;
export const HEALTH_CHECK_POLL_LIMIT_MS = 3 * 60_000;

export function isTerminalHealthCheck(check: Pick<HealthCheck, 'state'>): boolean {
  return check.state === 'DONE' || check.state === 'FAILED';
}

/** Check item order on screen (CL-05). */
export const HEALTH_CHECK_ITEM_ORDER: readonly HealthCheckItemType[] = [
  'INTERNET_LINE',
  'WIFI_SIGNAL',
  'CONNECTED_DEVICES',
];
