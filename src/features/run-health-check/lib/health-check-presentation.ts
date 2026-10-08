import type { HealthCheck, HealthCheckItem, HealthCheckItemType } from '@/entities/health-check';
import { paths } from '@/shared/config/routes';

export type HealthTone = 'success' | 'warning' | 'danger' | 'neutral';

export type StatusLabelKey = 'STABLE' | 'UNSTABLE' | 'DISCONNECTED' | 'PASS' | 'FAIL' | 'OFF';
export type DetailKey =
  | 'STABLE'
  | 'UNSTABLE'
  | 'DISCONNECTED'
  | 'PASS'
  | 'FAIL'
  | 'OFF'
  | 'NORMAL'
  | 'HOGGED'
  | 'HOGGED_unnamed'
  | 'HOGGED_crowded';
export type StateKey = 'PENDING' | 'RUNNING' | 'FAILED';

export interface ItemPresentation {
  tone: HealthTone;
  /** Coloured status word (`quality:status.*`); null for the devices item and unfinished items. */
  statusKey: StatusLabelKey | null;
  /** Sentence composed from the numbers (`quality:detail.*`), never raw technical values. */
  detail: { key: DetailKey; params: Record<string, string | number> } | null;
  /** Progress copy for PENDING / RUNNING / FAILED items (`quality:state.*`). */
  stateKey: StateKey | null;
  /** Detail goes on its own line under the status (XD: "Mất kết nối" / "Vui lòng kiểm tra…"). */
  detailOnNewLine: boolean;
}

const statusTone: Record<NonNullable<HealthCheckItem['status']>, HealthTone> = {
  STABLE: 'success',
  UNSTABLE: 'warning',
  DISCONNECTED: 'danger',
  PASS: 'success',
  FAIL: 'warning',
  OFF: 'neutral',
  NORMAL: 'success',
  HOGGED: 'warning',
};

/** Above this many active devices the line counts as hogged (SRC-HEALTH-SCRIPT §1). */
const CROWDED_DEVICE_COUNT = 25;

/**
 * Maps one check item to its copy and tone (SRC-HEALTH-SCRIPT@2026-10-07 §3, LLD P6-01): the
 * backend sends `status`, `action` and numbers (dropCount, activeDeviceCount, topDevice); the app
 * composes the sentence.
 */
export function presentHealthItem(item: HealthCheckItem): ItemPresentation {
  const base = { statusKey: null, detail: null, stateKey: null, detailOnNewLine: false } as const;
  if (item.state === 'PENDING' || item.state === 'RUNNING' || item.state === 'FAILED' || !item.status) {
    return { ...base, tone: 'neutral', stateKey: item.state === 'DONE' ? 'FAILED' : item.state };
  }

  const tone = statusTone[item.status];
  switch (item.status) {
    case 'STABLE':
      return {
        ...base,
        tone,
        statusKey: 'STABLE',
        detail: item.dropCount ? null : { key: 'STABLE', params: {} },
      };
    case 'UNSTABLE':
      return {
        ...base,
        tone,
        statusKey: 'UNSTABLE',
        detail: item.dropCount ? { key: 'UNSTABLE', params: { n: item.dropCount } } : null,
      };
    case 'DISCONNECTED':
      return {
        ...base,
        tone,
        statusKey: 'DISCONNECTED',
        detail: { key: 'DISCONNECTED', params: {} },
        detailOnNewLine: true,
      };
    case 'PASS':
    case 'FAIL':
    case 'OFF':
      return { ...base, tone, statusKey: item.status, detail: { key: item.status, params: {} } };
    case 'NORMAL':
      return {
        ...base,
        tone,
        detail: { key: 'NORMAL', params: { n: item.activeDeviceCount ?? 0 } },
      };
    case 'HOGGED': {
      const top = item.topDevice;
      if (top?.sharePercent !== undefined) {
        return {
          ...base,
          tone,
          detail: top.name
            ? { key: 'HOGGED', params: { name: top.name, percent: top.sharePercent } }
            : { key: 'HOGGED_unnamed', params: { percent: top.sharePercent } },
        };
      }
      const count = item.activeDeviceCount ?? 0;
      return {
        ...base,
        tone,
        detail:
          count > CROWDED_DEVICE_COUNT
            ? { key: 'HOGGED_crowded', params: { n: count } }
            : { key: 'NORMAL', params: { n: count } },
      };
    }
  }
}

/**
 * Devices tab URL for the devices item (BR-71): HOGGED sorts by traffic and focuses the top device.
 */
export function devicesTabUrl(item: HealthCheckItem): string {
  if (item.status !== 'HOGGED') return paths.devices;
  const params = new URLSearchParams({ sort: 'traffic' });
  if (item.topDevice?.macAddress) params.set('focus', item.topDevice.macAddress);
  return `${paths.devices}?${params.toString()}`;
}

export type StepState = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

/** Step states in display order; missing items count as PENDING. */
export function stepStates(
  check: HealthCheck | null,
  order: readonly HealthCheckItemType[],
): { itemType: HealthCheckItemType; state: StepState }[] {
  return order.map((itemType) => ({
    itemType,
    state: check?.items.find((item) => item.itemType === itemType)?.state ?? 'PENDING',
  }));
}

/** Progress 0–100 from item states: finished items count fully, the running one half. */
export function progressPercent(steps: { state: StepState }[], finished: boolean): number {
  if (finished) return 100;
  if (steps.length === 0) return 0;
  const score = steps.reduce(
    (sum, step) =>
      sum + (step.state === 'DONE' || step.state === 'FAILED' ? 1 : step.state === 'RUNNING' ? 0.5 : 0),
    0,
  );
  return Math.round((score / steps.length) * 100);
}
