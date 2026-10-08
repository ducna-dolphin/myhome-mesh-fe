import type { MeasurementMethod } from '@/entities/measurement-location';
import type { BridgeMethod, Platform } from '@/shared/super-app';

/**
 * How one location is measured (openapi-review §3):
 * - `bridge`: Android host measures (SPEED = `measureWifiSpeed`, RSSI = `readWifiRssi`);
 * - `manual`: the user types the RSSI (iPhone with AirPort Utility, or Android without a bridge meter).
 */
export type MeterChoice =
  { kind: 'bridge'; platform: 'ANDROID'; method: MeasurementMethod } | { kind: 'manual'; platform: Platform };

export interface SelectMeterInput {
  platform: Platform;
  /** `thresholds.androidMethod` from `GET /mesh/v1/signal-thresholds`. */
  androidMethod: MeasurementMethod;
  supports: (method: BridgeMethod) => boolean;
}

export const bridgeMethodFor: Record<MeasurementMethod, BridgeMethod> = {
  SPEED: 'measureWifiSpeed',
  RSSI: 'readWifiRssi',
};

const otherMethod: Record<MeasurementMethod, MeasurementMethod> = { SPEED: 'RSSI', RSSI: 'SPEED' };

/**
 * iOS → manual. Android → the backend-selected method when the host supports it, otherwise the
 * other bridge method, otherwise manual input.
 */
export function selectMeter({ platform, androidMethod, supports }: SelectMeterInput): MeterChoice {
  if (platform === 'IOS') return { kind: 'manual', platform };
  for (const method of [androidMethod, otherMethod[androidMethod]]) {
    if (supports(bridgeMethodFor[method])) return { kind: 'bridge', platform: 'ANDROID', method };
  }
  return { kind: 'manual', platform };
}
