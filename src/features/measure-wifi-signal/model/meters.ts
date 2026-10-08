import type { MeasurementMethod, MeasurementSubmission } from '@/entities/measurement-location';
import type { MyHomeBridge, Platform } from '@/shared/super-app';

/** LLD: one measurement takes about 8 seconds (native averages the samples). */
export const MEASURE_DURATION_SEC = 8;

/** iPhone RSSI input is the absolute value: 30…100 → −30…−100 dBm (QD-04). */
export const MANUAL_RSSI_MIN = 30;
export const MANUAL_RSSI_MAX = 100;

export class MeasurementAbortedError extends Error {
  constructor() {
    super('Measurement aborted');
    this.name = 'MeasurementAbortedError';
  }
}

export function isMeasurementAborted(error: unknown): error is MeasurementAbortedError {
  return error instanceof MeasurementAbortedError;
}

/** Bridge calls cannot be cancelled; an abort just stops waiting and drops the result. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new MeasurementAbortedError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new MeasurementAbortedError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        if (signal.aborted) reject(new MeasurementAbortedError());
        else resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(signal.aborted ? new MeasurementAbortedError() : error);
      },
    );
  });
}

export interface BridgeMeter {
  method: MeasurementMethod;
  measure(signal: AbortSignal, durationSec?: number): Promise<MeasurementSubmission>;
}

/** Method A (QD-02, QD-03): download speed + latency. */
export function createSpeedBridgeMeter(bridge: Pick<MyHomeBridge, 'measureWifiSpeed'>): BridgeMeter {
  return {
    method: 'SPEED',
    async measure(signal, durationSec = MEASURE_DURATION_SEC) {
      const result = await abortable(bridge.measureWifiSpeed({ durationSec }), signal);
      return {
        method: 'SPEED',
        platform: 'ANDROID',
        downloadMbps: result.downloadMbps,
        latencyMs: result.latencyMs,
      };
    },
  };
}

/** Method B (QD-04): RSSI averaged by the host. */
export function createRssiBridgeMeter(bridge: Pick<MyHomeBridge, 'readWifiRssi'>): BridgeMeter {
  return {
    method: 'RSSI',
    async measure(signal, durationSec = MEASURE_DURATION_SEC) {
      const result = await abortable(bridge.readWifiRssi({ durationSec }), signal);
      return {
        method: 'RSSI',
        platform: 'ANDROID',
        source: 'BRIDGE',
        rssiDbm: Math.round(result.rssiDbm),
        sampleCount: result.sampleCount,
      };
    },
  };
}

export function createBridgeMeter(
  bridge: Pick<MyHomeBridge, 'measureWifiSpeed' | 'readWifiRssi'>,
  method: MeasurementMethod,
): BridgeMeter {
  return method === 'SPEED' ? createSpeedBridgeMeter(bridge) : createRssiBridgeMeter(bridge);
}

/** Parses the digits typed after the fixed "−"; `null` when empty or outside 30…100. */
export function parseManualRssi(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw)) return null;
  const value = Number(raw);
  return value >= MANUAL_RSSI_MIN && value <= MANUAL_RSSI_MAX ? value : null;
}

/** Manual input (iPhone AirPort Utility, or Android without a bridge meter). */
export function createManualSubmission(absoluteRssi: number, platform: Platform): MeasurementSubmission {
  return { method: 'RSSI', platform, source: 'MANUAL', rssiDbm: -Math.abs(absoluteRssi) };
}
