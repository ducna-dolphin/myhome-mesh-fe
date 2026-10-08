import type { ApiSchemas } from '@/shared/api';

/**
 * FE model of one measurement, covering both Android methods (openapi-review §3):
 * - SPEED: Android bridge `measureWifiSpeed` (QD-02, QD-03).
 * - RSSI: Android bridge `readWifiRssi` (source BRIDGE) or iPhone AirPort Utility input (source MANUAL, QD-04).
 */
export type MeasurementSubmission =
  | { method: 'SPEED'; platform: 'ANDROID'; downloadMbps: number; latencyMs: number }
  | {
      method: 'RSSI';
      platform: 'ANDROID' | 'IOS';
      source: 'BRIDGE' | 'MANUAL';
      rssiDbm: number;
      sampleCount?: number | null;
    };

export type MeasurementInputDto = ApiSchemas['MeasurementInput'];

/** RSSI accepted by the contract (`MeasurementInput.rssiDbm`). */
export const RSSI_MIN_DBM = -100;
export const RSSI_MAX_DBM = -30;

/**
 * Maps the FE submission to the body of the CURRENT contract (`MeasurementInput`):
 * `{ platform, measuredAt, downloadMbps, latencyMs }` or `{ platform, measuredAt, rssiDbm }`.
 * FE-only fields (`method`, `source`, `sampleCount`) are stripped until the proposed
 * discriminated `MeasurementInput` (R-03) is adopted.
 */
export function toMeasurementInput(
  submission: MeasurementSubmission,
  measuredAt: string,
): MeasurementInputDto {
  if (submission.method === 'SPEED') {
    return {
      platform: submission.platform,
      measuredAt,
      downloadMbps: submission.downloadMbps,
      latencyMs: submission.latencyMs,
    };
  }
  return {
    platform: submission.platform,
    measuredAt,
    rssiDbm: Math.round(submission.rssiDbm),
  };
}
