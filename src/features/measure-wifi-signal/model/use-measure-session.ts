import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  classifyLevel,
  DEFAULT_SIGNAL_THRESHOLDS,
  useCreateMeasurementMutation,
  useSignalThresholdsQuery,
  type MeasurementSubmission,
  type SignalLevel,
  type SignalThresholds,
} from '@/entities/measurement-location';
import { createIdempotencyKey, isApiError } from '@/shared/api';
import { useSuperApp, type NetworkChangeEvent, type Platform } from '@/shared/super-app';
import { checkMeasureConditions, type ConditionFailure } from './check-conditions';
import { detectPlatform } from './detect-platform';
import { createBridgeMeter, createManualSubmission, isMeasurementAborted } from './meters';
import { selectMeter, type MeterChoice } from './select-meter';

/** LS-01: the app in background longer than this cancels the measurement. */
export const BACKGROUND_CANCEL_MS = 60_000;

export type MeasureMode = 'measure' | 'view';
export type CancelReason = 'NETWORK_CHANGED' | 'BACKGROUND';

/** A finished measurement waiting to be stored; resent with the SAME key after a network error (LS-02). */
export interface PendingMeasurement {
  submission: MeasurementSubmission;
  measuredAt: string;
  idempotencyKey: string;
  previewLevel: SignalLevel;
}

export type MeasurePhase =
  | { name: 'preparing' }
  | { name: 'view' }
  | { name: 'manual-intro'; showFullGuide: boolean; returnedFromStore: boolean }
  | { name: 'manual-input' }
  | { name: 'checking' }
  | { name: 'condition-failed'; reason: ConditionFailure }
  | { name: 'measuring'; startedAt: number }
  | { name: 'saving'; pending: PendingMeasurement }
  | {
      name: 'result';
      level: SignalLevel;
      measuredAt: string;
      measurementId: string | null;
      /** DK-04: measured on another modem's Wi-Fi, shown but not saved. */
      trial: boolean;
    }
  | { name: 'unsynced'; pending: PendingMeasurement; resending: boolean }
  | { name: 'cancelled'; reason: CancelReason }
  | { name: 'failed'; error: unknown };

export interface MeasureSessionInput {
  contractId: string;
  locationId: string;
  mode: MeasureMode;
  planDownloadMbps: number | null | undefined;
  modemMac: string | null | undefined;
  /** Called once a measurement is stored (toast). */
  onSaved?: (level: SignalLevel) => void;
}

const normalizeMac = (mac: string) => mac.trim().toUpperCase().replace(/-/g, ':');

/** Network failure without a response: keep the result and resend later (LS-02). */
function isOfflineError(error: unknown): boolean {
  return isApiError(error) && error.status === null;
}

/** LS-01: lost network or switched to another Wi-Fi while measuring. */
export function isDisruptiveNetworkChange(event: NetworkChangeEvent, startBssid: string | null): boolean {
  if (event.type !== 'WIFI') return true;
  return Boolean(startBssid && event.bssid && normalizeMac(event.bssid) !== startBssid);
}

/**
 * State machine of the measure sheet (P2-03, P2-04, P2-06):
 * preparing → (view) → checking → condition-failed | measuring → saving → result | unsynced,
 * with the manual branch manual-intro → manual-input → saving. Unmounting aborts without saving.
 */
export function useMeasureSession({
  contractId,
  locationId,
  mode,
  planDownloadMbps,
  modemMac,
  onSaved,
}: MeasureSessionInput) {
  const bridge = useSuperApp();
  const thresholdsQuery = useSignalThresholdsQuery();
  const mutation = useCreateMeasurementMutation(contractId);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [phase, setPhase] = useState<MeasurePhase>({ name: 'preparing' });
  const [latencyOnly, setLatencyOnly] = useState(false);
  const [lastMeasurementId, setLastMeasurementId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  // Thresholds stay in memory for the session; on error fall back to the QD defaults
  // (the backend classifies again on save).
  const thresholds: SignalThresholds | null =
    thresholdsQuery.data ?? (thresholdsQuery.isError ? DEFAULT_SIGNAL_THRESHOLDS : null);

  useEffect(() => {
    let active = true;
    void detectPlatform(bridge).then((detected) => {
      if (active) setPlatform(detected);
    });
    return () => {
      active = false;
    };
  }, [bridge]);

  const meter: MeterChoice | null = useMemo(
    () =>
      platform && thresholds
        ? selectMeter({
            platform,
            androidMethod: thresholds.androidMethod,
            supports: (method) => bridge.supports(method),
          })
        : null,
    [bridge, platform, thresholds],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const update = useCallback((next: MeasurePhase) => {
    if (mountedRef.current) setPhase(next);
  }, []);

  const save = useCallback(
    async (pending: PendingMeasurement) => {
      update({ name: 'saving', pending });
      try {
        const measurement = await mutation.mutateAsync({
          locationId,
          submission: pending.submission,
          measuredAt: pending.measuredAt,
          idempotencyKey: pending.idempotencyKey,
        });
        if (mountedRef.current) setLastMeasurementId(measurement.measurementId);
        update({
          name: 'result',
          level: measurement.level,
          measuredAt: measurement.measuredAt,
          measurementId: measurement.measurementId,
          trial: false,
        });
        onSavedRef.current?.(measurement.level);
      } catch (error) {
        update(
          isOfflineError(error) ? { name: 'unsynced', pending, resending: false } : { name: 'failed', error },
        );
      }
    },
    [locationId, mutation, update],
  );

  const finish = useCallback(
    (submission: MeasurementSubmission, trial: boolean) => {
      const measuredAt = new Date().toISOString();
      const previewLevel = classifyLevel(
        submission,
        thresholds ?? DEFAULT_SIGNAL_THRESHOLDS,
        planDownloadMbps,
      );
      if (trial) {
        update({ name: 'result', level: previewLevel, measuredAt, measurementId: null, trial: true });
        return;
      }
      void save({ submission, measuredAt, idempotencyKey: createIdempotencyKey(), previewLevel });
    },
    [planDownloadMbps, save, thresholds, update],
  );

  const runBridge = useCallback(
    async (method: 'SPEED' | 'RSSI', trial: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let startBssid: string | null = null;
      if (!trial) {
        update({ name: 'checking' });
        const check = await checkMeasureConditions({ bridge, method, modemMac, planDownloadMbps });
        if (controller.signal.aborted) return;
        if (!check.ok) {
          update({ name: 'condition-failed', reason: check.reason });
          return;
        }
        startBssid = check.bssid;
        if (mountedRef.current) setLatencyOnly(check.latencyOnly);
      } else if (mountedRef.current) {
        setLatencyOnly(method === 'SPEED' && !(planDownloadMbps && planDownloadMbps > 0));
      }

      update({ name: 'measuring', startedAt: Date.now() });
      const cancel = (reason: CancelReason) => {
        if (controller.signal.aborted) return;
        controller.abort();
        update({ name: 'cancelled', reason });
      };

      let unsubscribe = () => {};
      if (bridge.supports('onNetworkChange')) {
        try {
          unsubscribe = bridge.onNetworkChange((event) => {
            if (isDisruptiveNetworkChange(event, startBssid)) cancel('NETWORK_CHANGED');
          });
        } catch {
          // Host without the event: LS-01 cannot be enforced (S-05).
        }
      }
      let hiddenAt: number | null = null;
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') hiddenAt = Date.now();
        else if (hiddenAt !== null && Date.now() - hiddenAt > BACKGROUND_CANCEL_MS) cancel('BACKGROUND');
      };
      document.addEventListener('visibilitychange', onVisibility);

      try {
        const submission = await createBridgeMeter(bridge, method).measure(controller.signal);
        if (controller.signal.aborted) return;
        finish(submission, trial);
      } catch (error) {
        if (!isMeasurementAborted(error) && !controller.signal.aborted) update({ name: 'failed', error });
      } finally {
        unsubscribe();
        document.removeEventListener('visibilitychange', onVisibility);
      }
    },
    [bridge, finish, modemMac, planDownloadMbps, update],
  );

  /** Starts (or restarts) a measurement with the selected meter. */
  const start = useCallback(() => {
    if (!meter) return;
    if (meter.kind === 'bridge') {
      void runBridge(meter.method, false);
      return;
    }
    // Android without a bridge meter has no AirPort Utility guide: go straight to the input.
    update(
      meter.platform === 'IOS'
        ? { name: 'manual-intro', showFullGuide: false, returnedFromStore: false }
        : { name: 'manual-input' },
    );
  }, [meter, runBridge, update]);

  useEffect(() => {
    if (!meter || startedRef.current) return;
    startedRef.current = true;
    if (mode === 'view') update({ name: 'view' });
    else start();
  }, [meter, mode, start, update]);

  /** DK-04: measure on another modem's Wi-Fi without saving. */
  const measureTrial = useCallback(() => {
    if (meter?.kind === 'bridge') void runBridge(meter.method, true);
  }, [meter, runBridge]);

  const submitManual = useCallback(
    (absoluteRssi: number) => {
      if (!meter) return;
      finish(createManualSubmission(absoluteRssi, meter.platform), false);
    },
    [finish, meter],
  );

  const resend = useCallback(() => {
    if (phase.name !== 'unsynced' || phase.resending) return;
    update({ ...phase, resending: true });
    void save(phase.pending);
  }, [phase, save, update]);

  // LS-02: resend automatically when the connection comes back.
  useEffect(() => {
    if (phase.name !== 'unsynced') return;
    window.addEventListener('online', resend);
    return () => window.removeEventListener('online', resend);
  }, [phase.name, resend]);

  return {
    phase,
    setPhase: update,
    meter,
    thresholds: thresholds ?? DEFAULT_SIGNAL_THRESHOLDS,
    latencyOnly,
    lastMeasurementId,
    start,
    measureTrial,
    submitManual,
    resend,
  };
}

export type MeasureSession = ReturnType<typeof useMeasureSession>;
