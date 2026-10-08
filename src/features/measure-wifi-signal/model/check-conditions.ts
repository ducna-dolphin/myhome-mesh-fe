import type { MeasurementMethod } from '@/entities/measurement-location';
import type { MyHomeBridge } from '@/shared/super-app';

/** Blocking reasons (DK-02, DK-03) and the "trial only" case (DK-04). */
export type ConditionFailure = 'NOT_WIFI' | 'VPN_ACTIVE' | 'WRONG_MODEM';

export interface ConditionCheckInput {
  bridge: Pick<MyHomeBridge, 'supports' | 'getNetworkInfo' | 'getWifiInfo'>;
  method: MeasurementMethod;
  /** ONT MAC from P5-01; `null` when unknown (the BSSID check is then skipped). */
  modemMac: string | null | undefined;
  /** Plan speed from P1-02; SPEED without it classifies by latency only (Q-48, N-06). */
  planDownloadMbps: number | null | undefined;
}

export type ConditionCheckResult =
  | {
      ok: true;
      /** BSSID read at the start, used to detect a Wi-Fi switch during the measurement (LS-01). */
      bssid: string | null;
      /** SPEED without plan speed: level from latency only. */
      latencyOnly: boolean;
    }
  | { ok: false; reason: ConditionFailure; bssid: string | null };

const normalizeMac = (mac: string) => mac.trim().toUpperCase().replace(/-/g, ':');

/**
 * Pre-measure checks for the Android bridge methods, in the DK-02 order:
 * (1) Wi-Fi, not cellular; (2) VPN off; (3) connected BSSID equals the contract's modem MAC.
 * A host function that is missing or fails is skipped, not treated as a failure (S-02, S-03);
 * an unreadable BSSID (no location permission) is skipped too (DK-05, N-04 pending).
 */
export async function checkMeasureConditions({
  bridge,
  method,
  modemMac,
  planDownloadMbps,
}: ConditionCheckInput): Promise<ConditionCheckResult> {
  if (bridge.supports('getNetworkInfo')) {
    const network = await bridge.getNetworkInfo().catch(() => null);
    if (network && network.type !== 'WIFI') return { ok: false, reason: 'NOT_WIFI', bssid: null };
    if (network?.vpnActive) return { ok: false, reason: 'VPN_ACTIVE', bssid: null };
  }

  let bssid: string | null = null;
  if (bridge.supports('getWifiInfo')) {
    const wifi = await bridge.getWifiInfo().catch(() => null);
    bssid = wifi?.bssid ? normalizeMac(wifi.bssid) : null;
    if (bssid && modemMac && bssid !== normalizeMac(modemMac)) {
      return { ok: false, reason: 'WRONG_MODEM', bssid };
    }
  }

  const latencyOnly = method === 'SPEED' && !(planDownloadMbps && planDownloadMbps > 0);
  return { ok: true, bssid, latencyOnly };
}
