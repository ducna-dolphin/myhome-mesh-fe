import type { SignalLevel } from '../model/measurement-location-schema';
import type { MeasurementSubmission } from '../model/measurement-submission';
import type { RssiThresholds, SignalThresholds, SpeedThresholds } from '../model/signal-thresholds';

const downgrade: Record<SignalLevel, SignalLevel> = { GOOD: 'FAIR', FAIR: 'WEAK', WEAK: 'WEAK' };

/**
 * QD-02 + QD-03: percent of plan speed (≥ good → GOOD, ≥ fair → FAIR, else WEAK), then one level
 * down when latency exceeds `latencyDowngradeMs`. Without a plan speed (Q-48) only latency is
 * evaluated (proposal N-06): GOOD, or FAIR when latency is too high.
 */
export function classifySpeedLevel(
  { downloadMbps, latencyMs }: { downloadMbps: number; latencyMs: number },
  planDownloadMbps: number | null | undefined,
  thresholds: SpeedThresholds,
): SignalLevel {
  let level: SignalLevel = 'GOOD';
  if (planDownloadMbps && planDownloadMbps > 0) {
    const percent = (downloadMbps / planDownloadMbps) * 100;
    if (percent >= thresholds.goodMinPercent) level = 'GOOD';
    else if (percent >= thresholds.fairMinPercent) level = 'FAIR';
    else level = 'WEAK';
  }
  return latencyMs > thresholds.latencyDowngradeMs ? downgrade[level] : level;
}

/** QD-04: above `goodAboveDbm` → GOOD, above `fairAboveDbm` → FAIR, otherwise WEAK. */
export function classifyRssiLevel(rssiDbm: number, thresholds: RssiThresholds): SignalLevel {
  if (rssiDbm > thresholds.goodAboveDbm) return 'GOOD';
  if (rssiDbm > thresholds.fairAboveDbm) return 'FAIR';
  return 'WEAK';
}

/** Preview level of a measurement with the backend thresholds (backend re-classifies on save). */
export function classifyLevel(
  submission: MeasurementSubmission,
  thresholds: SignalThresholds,
  planDownloadMbps?: number | null,
): SignalLevel {
  return submission.method === 'SPEED'
    ? classifySpeedLevel(submission, planDownloadMbps, thresholds.speed)
    : classifyRssiLevel(submission.rssiDbm, thresholds.rssi);
}
