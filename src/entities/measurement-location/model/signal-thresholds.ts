import { z } from 'zod';
import type { AcceptsContract, ApiSchemas } from '@/shared/api';

export const measurementMethodSchema = z.enum(['SPEED', 'RSSI']);
export type MeasurementMethod = z.infer<typeof measurementMethodSchema>;

const speedPartialSchema = z.object({
  goodMinPercent: z.number().optional(),
  fairMinPercent: z.number().optional(),
  latencyDowngradeMs: z.number().optional(),
});

const rssiPartialSchema = z.object({
  goodAboveDbm: z.number().optional(),
  fairAboveDbm: z.number().optional(),
});

/** Proposed contract (openapi-review §3): `{ androidMethod, speed, rssi }`. */
const proposedThresholdsSchema = z.object({
  androidMethod: measurementMethodSchema.optional(),
  speed: speedPartialSchema,
  rssi: rssiPartialSchema,
});

/** Current contract: `{ android, ios }` (+ optional `androidMethod` extension used by the mock). */
const currentThresholdsSchema = z.object({
  androidMethod: measurementMethodSchema.optional(),
  android: speedPartialSchema,
  ios: rssiPartialSchema,
});

export interface SpeedThresholds {
  goodMinPercent: number;
  fairMinPercent: number;
  latencyDowngradeMs: number;
}

export interface RssiThresholds {
  goodAboveDbm: number;
  fairAboveDbm: number;
}

export interface SignalThresholds {
  /** Android measurement flow selected by the backend; defaults to SPEED (current LLD). */
  androidMethod: MeasurementMethod;
  speed: SpeedThresholds;
  rssi: RssiThresholds;
}

/** QD-02/03/04 defaults, used only when the backend omits a value (R-05: fields are optional). */
export const DEFAULT_SIGNAL_THRESHOLDS: SignalThresholds = {
  androidMethod: 'SPEED',
  speed: { goodMinPercent: 70, fairMinPercent: 40, latencyDowngradeMs: 50 },
  rssi: { goodAboveDbm: -60, fairAboveDbm: -70 },
};

/** Accepts both the current and the proposed shape and normalizes to `{ androidMethod, speed, rssi }`. */
export const signalThresholdsSchema = z
  .union([proposedThresholdsSchema, currentThresholdsSchema])
  .transform((value): SignalThresholds => {
    const speed = 'speed' in value ? value.speed : value.android;
    const rssi = 'rssi' in value ? value.rssi : value.ios;
    const defaults = DEFAULT_SIGNAL_THRESHOLDS;
    return {
      androidMethod: value.androidMethod ?? defaults.androidMethod,
      speed: {
        goodMinPercent: speed.goodMinPercent ?? defaults.speed.goodMinPercent,
        fairMinPercent: speed.fairMinPercent ?? defaults.speed.fairMinPercent,
        latencyDowngradeMs: speed.latencyDowngradeMs ?? defaults.speed.latencyDowngradeMs,
      },
      rssi: {
        goodAboveDbm: rssi.goodAboveDbm ?? defaults.rssi.goodAboveDbm,
        fairAboveDbm: rssi.fairAboveDbm ?? defaults.rssi.fairAboveDbm,
      },
    };
  });

void (true satisfies AcceptsContract<typeof signalThresholdsSchema, ApiSchemas['SignalThresholds']>);
