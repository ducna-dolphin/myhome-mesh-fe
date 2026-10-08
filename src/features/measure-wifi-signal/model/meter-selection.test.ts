import { describe, expect, it } from 'vitest';
import { createFakeSuperAppClient } from '@/shared/test';
import { BridgeError, type BridgeMethod } from '@/shared/super-app';
import { checkMeasureConditions } from './check-conditions';
import { detectPlatform, platformFromUserAgent } from './detect-platform';
import { introVariantFor } from './manual-onboarding';
import {
  createManualSubmission,
  createRssiBridgeMeter,
  createSpeedBridgeMeter,
  isMeasurementAborted,
  parseManualRssi,
} from './meters';
import { selectMeter } from './select-meter';
import { isDisruptiveNetworkChange } from './use-measure-session';

const supportsOnly =
  (...methods: BridgeMethod[]) =>
  (method: BridgeMethod) =>
    methods.includes(method);

describe('selectMeter', () => {
  it.each([
    // platform, androidMethod, supported bridge meters, expected
    ['IOS', 'SPEED', ['measureWifiSpeed', 'readWifiRssi'], { kind: 'manual', platform: 'IOS' }],
    ['IOS', 'RSSI', ['readWifiRssi'], { kind: 'manual', platform: 'IOS' }],
    ['ANDROID', 'SPEED', ['measureWifiSpeed', 'readWifiRssi'], { kind: 'bridge', method: 'SPEED' }],
    ['ANDROID', 'RSSI', ['measureWifiSpeed', 'readWifiRssi'], { kind: 'bridge', method: 'RSSI' }],
    ['ANDROID', 'SPEED', ['readWifiRssi'], { kind: 'bridge', method: 'RSSI' }],
    ['ANDROID', 'RSSI', ['measureWifiSpeed'], { kind: 'bridge', method: 'SPEED' }],
    ['ANDROID', 'SPEED', [], { kind: 'manual', platform: 'ANDROID' }],
    ['ANDROID', 'RSSI', [], { kind: 'manual', platform: 'ANDROID' }],
  ] as const)('%s + androidMethod %s + supports %j → %j', (platform, androidMethod, supported, expected) => {
    expect(selectMeter({ platform, androidMethod, supports: supportsOnly(...supported) })).toMatchObject(
      expected,
    );
  });
});

describe('detectPlatform', () => {
  it('uses getAppInfo when the host supports it', async () => {
    const bridge = createFakeSuperAppClient();
    bridge.getAppInfo.mockResolvedValueOnce({ platform: 'IOS', appVersion: '1', osVersion: '18' });
    await expect(detectPlatform(bridge, 'Android')).resolves.toBe('IOS');
  });

  it('falls back to the user agent when getAppInfo is missing or fails', async () => {
    const unsupported = createFakeSuperAppClient(undefined, ['getMiniAppToken']);
    await expect(detectPlatform(unsupported, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)')).resolves.toBe(
      'IOS',
    );
    const failing = createFakeSuperAppClient();
    failing.getAppInfo.mockRejectedValueOnce(new BridgeError('FAILED', 'getAppInfo'));
    await expect(detectPlatform(failing, 'Mozilla/5.0 (Linux; Android 15)')).resolves.toBe('ANDROID');
    expect(platformFromUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('IOS');
  });
});

describe('checkMeasureConditions (DK-02…DK-06)', () => {
  const modemMac = 'a4-56-02-3c-11-9f';

  it('passes on home Wi-Fi, VPN off and matching BSSID (case-insensitive)', async () => {
    const bridge = createFakeSuperAppClient();
    await expect(
      checkMeasureConditions({ bridge, method: 'RSSI', modemMac, planDownloadMbps: 300 }),
    ).resolves.toEqual({ ok: true, bssid: 'A4:56:02:3C:11:9F', latencyOnly: false });
  });

  it('blocks on cellular, then on VPN, in that order', async () => {
    const bridge = createFakeSuperAppClient();
    bridge.getNetworkInfo.mockResolvedValueOnce({ type: 'CELLULAR', vpnActive: true });
    await expect(
      checkMeasureConditions({ bridge, method: 'SPEED', modemMac, planDownloadMbps: 300 }),
    ).resolves.toMatchObject({ ok: false, reason: 'NOT_WIFI' });
    bridge.getNetworkInfo.mockResolvedValueOnce({ type: 'WIFI', vpnActive: true });
    await expect(
      checkMeasureConditions({ bridge, method: 'SPEED', modemMac, planDownloadMbps: 300 }),
    ).resolves.toMatchObject({ ok: false, reason: 'VPN_ACTIVE' });
  });

  it('flags another modem BSSID', async () => {
    const bridge = createFakeSuperAppClient();
    bridge.getWifiInfo.mockResolvedValueOnce({
      bssid: '00:11:22:33:44:55',
      ipAddress: null,
      macAddress: null,
    });
    await expect(
      checkMeasureConditions({ bridge, method: 'RSSI', modemMac, planDownloadMbps: 300 }),
    ).resolves.toMatchObject({ ok: false, reason: 'WRONG_MODEM' });
  });

  it('skips checks the host cannot answer (unsupported, failing, unreadable BSSID, unknown MAC)', async () => {
    const unsupported = createFakeSuperAppClient(undefined, ['measureWifiSpeed']);
    await expect(
      checkMeasureConditions({ bridge: unsupported, method: 'SPEED', modemMac, planDownloadMbps: 300 }),
    ).resolves.toMatchObject({ ok: true });
    expect(unsupported.getNetworkInfo).not.toHaveBeenCalled();

    const failing = createFakeSuperAppClient();
    failing.getNetworkInfo.mockRejectedValueOnce(new BridgeError('FAILED', 'getNetworkInfo'));
    failing.getWifiInfo.mockResolvedValueOnce({ bssid: null, ipAddress: null, macAddress: null });
    await expect(
      checkMeasureConditions({ bridge: failing, method: 'RSSI', modemMac, planDownloadMbps: 300 }),
    ).resolves.toMatchObject({ ok: true, bssid: null });

    const noMac = createFakeSuperAppClient();
    noMac.getWifiInfo.mockResolvedValueOnce({
      bssid: '00:11:22:33:44:55',
      ipAddress: null,
      macAddress: null,
    });
    await expect(
      checkMeasureConditions({ bridge: noMac, method: 'RSSI', modemMac: null, planDownloadMbps: 300 }),
    ).resolves.toMatchObject({ ok: true });
  });

  it('marks SPEED without plan speed as latency-only', async () => {
    const bridge = createFakeSuperAppClient();
    await expect(
      checkMeasureConditions({ bridge, method: 'SPEED', modemMac, planDownloadMbps: null }),
    ).resolves.toMatchObject({ ok: true, latencyOnly: true });
    await expect(
      checkMeasureConditions({ bridge, method: 'RSSI', modemMac, planDownloadMbps: null }),
    ).resolves.toMatchObject({ ok: true, latencyOnly: false });
  });
});

describe('meters', () => {
  it('maps bridge results to submissions', async () => {
    const bridge = createFakeSuperAppClient();
    const signal = new AbortController().signal;
    await expect(createSpeedBridgeMeter(bridge).measure(signal)).resolves.toEqual({
      method: 'SPEED',
      platform: 'ANDROID',
      downloadMbps: 200,
      latencyMs: 20,
    });
    expect(bridge.measureWifiSpeed).toHaveBeenCalledWith({ durationSec: 8 });
    await expect(createRssiBridgeMeter(bridge).measure(signal)).resolves.toEqual({
      method: 'RSSI',
      platform: 'ANDROID',
      source: 'BRIDGE',
      rssiDbm: -55,
      sampleCount: 8,
    });
  });

  it('rejects with an abort error and drops a late result', async () => {
    const bridge = createFakeSuperAppClient();
    let resolve!: (value: { downloadMbps: number; latencyMs: number }) => void;
    bridge.measureWifiSpeed.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    const controller = new AbortController();
    const pending = createSpeedBridgeMeter(bridge).measure(controller.signal);
    controller.abort();
    resolve({ downloadMbps: 1, latencyMs: 1 });
    const error = await pending.catch((reason: unknown) => reason);
    expect(isMeasurementAborted(error)).toBe(true);
  });

  it('validates the manual RSSI (30…100) and negates it', () => {
    expect(parseManualRssi('')).toBeNull();
    expect(parseManualRssi('29')).toBeNull();
    expect(parseManualRssi('101')).toBeNull();
    expect(parseManualRssi('6a')).toBeNull();
    expect(parseManualRssi('30')).toBe(30);
    expect(parseManualRssi('100')).toBe(100);
    expect(createManualSubmission(65, 'IOS')).toEqual({
      method: 'RSSI',
      platform: 'IOS',
      source: 'MANUAL',
      rssiDbm: -65,
    });
  });
});

describe('LS-01 and onboarding helpers', () => {
  it('treats losing Wi-Fi or a BSSID change as disruptive', () => {
    expect(isDisruptiveNetworkChange({ type: 'NONE', bssid: null }, 'A4:56:02:3C:11:9F')).toBe(true);
    expect(isDisruptiveNetworkChange({ type: 'WIFI', bssid: '00:11:22:33:44:55' }, 'A4:56:02:3C:11:9F')).toBe(
      true,
    );
    expect(isDisruptiveNetworkChange({ type: 'WIFI', bssid: 'a4:56:02:3c:11:9f' }, 'A4:56:02:3C:11:9F')).toBe(
      false,
    );
    expect(isDisruptiveNetworkChange({ type: 'WIFI', bssid: null }, null)).toBe(false);
  });

  it('picks the iPhone intro variant from the session state', () => {
    expect(introVariantFor({ auStatus: 'unknown', iosGuideSeen: false })).toBe('need-app');
    expect(introVariantFor({ auStatus: 'unknown', iosGuideSeen: true })).toBe('need-app');
    expect(introVariantFor({ auStatus: 'installed', iosGuideSeen: false })).toBe('guide-full');
    expect(introVariantFor({ auStatus: 'installed', iosGuideSeen: true })).toBe('guide-short');
  });
});
