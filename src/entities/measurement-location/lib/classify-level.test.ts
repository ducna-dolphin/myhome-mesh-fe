import { describe, expect, it } from 'vitest';
import { DEFAULT_SIGNAL_THRESHOLDS, signalThresholdsSchema } from '../model/signal-thresholds';
import { classifyLevel, classifyRssiLevel, classifySpeedLevel } from './classify-level';

const speed = DEFAULT_SIGNAL_THRESHOLDS.speed; // good ≥ 70%, fair ≥ 40%, latency > 50 ms downgrades
const rssi = DEFAULT_SIGNAL_THRESHOLDS.rssi; // > -60 GOOD, > -70 FAIR

describe('classifySpeedLevel (QD-02, QD-03)', () => {
  it.each([
    [210, 'GOOD'], // exactly 70% of 300
    [209.99, 'FAIR'],
    [120, 'FAIR'], // exactly 40%
    [119.99, 'WEAK'],
    [0, 'WEAK'],
    [400, 'GOOD'],
  ] as const)('%s Mbps of a 300 Mbps plan → %s', (downloadMbps, level) => {
    expect(classifySpeedLevel({ downloadMbps, latencyMs: 10 }, 300, speed)).toBe(level);
  });

  it('downgrades one level only when latency is strictly above the threshold', () => {
    expect(classifySpeedLevel({ downloadMbps: 300, latencyMs: 50 }, 300, speed)).toBe('GOOD');
    expect(classifySpeedLevel({ downloadMbps: 300, latencyMs: 50.1 }, 300, speed)).toBe('FAIR');
    expect(classifySpeedLevel({ downloadMbps: 150, latencyMs: 80 }, 300, speed)).toBe('WEAK');
    expect(classifySpeedLevel({ downloadMbps: 10, latencyMs: 80 }, 300, speed)).toBe('WEAK');
  });

  it('evaluates latency only when the plan speed is unknown (Q-48, N-06)', () => {
    expect(classifySpeedLevel({ downloadMbps: 5, latencyMs: 20 }, null, speed)).toBe('GOOD');
    expect(classifySpeedLevel({ downloadMbps: 5, latencyMs: 60 }, 0, speed)).toBe('FAIR');
  });
});

describe('classifyRssiLevel (QD-04)', () => {
  it.each([
    [-30, 'GOOD'],
    [-59, 'GOOD'],
    [-60, 'FAIR'], // "trên -60" is strict
    [-69, 'FAIR'],
    [-70, 'WEAK'],
    [-100, 'WEAK'],
  ] as const)('%s dBm → %s', (rssiDbm, level) => {
    expect(classifyRssiLevel(rssiDbm, rssi)).toBe(level);
  });
});

describe('classifyLevel', () => {
  it('dispatches by method using backend thresholds', () => {
    const thresholds = signalThresholdsSchema.parse({
      androidMethod: 'RSSI',
      speed: { goodMinPercent: 80, fairMinPercent: 50, latencyDowngradeMs: 30 },
      rssi: { goodAboveDbm: -55, fairAboveDbm: -65 },
    });
    expect(
      classifyLevel(
        { method: 'SPEED', platform: 'ANDROID', downloadMbps: 75, latencyMs: 10 },
        thresholds,
        100,
      ),
    ).toBe('FAIR');
    expect(
      classifyLevel(
        { method: 'RSSI', platform: 'ANDROID', source: 'BRIDGE', rssiDbm: -58, sampleCount: 8 },
        thresholds,
      ),
    ).toBe('FAIR');
    expect(
      classifyLevel({ method: 'RSSI', platform: 'IOS', source: 'MANUAL', rssiDbm: -50 }, thresholds),
    ).toBe('GOOD');
  });
});

describe('signalThresholdsSchema', () => {
  it('normalizes the current contract shape ({ android, ios }) with SPEED as default method', () => {
    expect(
      signalThresholdsSchema.parse({
        android: { goodMinPercent: 75, fairMinPercent: 45, latencyDowngradeMs: 40 },
        ios: { goodAboveDbm: -62, fairAboveDbm: -72 },
      }),
    ).toEqual({
      androidMethod: 'SPEED',
      speed: { goodMinPercent: 75, fairMinPercent: 45, latencyDowngradeMs: 40 },
      rssi: { goodAboveDbm: -62, fairAboveDbm: -72 },
    });
  });

  it('accepts the proposed shape ({ androidMethod, speed, rssi })', () => {
    expect(
      signalThresholdsSchema.parse({
        androidMethod: 'RSSI',
        speed: { goodMinPercent: 70, fairMinPercent: 40, latencyDowngradeMs: 50 },
        rssi: { goodAboveDbm: -60, fairAboveDbm: -70 },
      }).androidMethod,
    ).toBe('RSSI');
  });

  it('fills defaults for missing optional values (R-05)', () => {
    expect(signalThresholdsSchema.parse({ android: {}, ios: {} })).toEqual(DEFAULT_SIGNAL_THRESHOLDS);
  });

  it('rejects unrelated payloads', () => {
    expect(signalThresholdsSchema.safeParse({ foo: 1 }).success).toBe(false);
    expect(signalThresholdsSchema.safeParse({ androidMethod: 'WIFI', speed: {}, rssi: {} }).success).toBe(
      false,
    );
  });
});
