import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MeasurementLocation, SignalLevel } from '@/entities/measurement-location';
import { isApiError, useErrorMessage } from '@/shared/api';
import { AIRPORT_UTILITY_APP_STORE_URL } from '@/shared/config/survey-deeplinks';
import { useTranslation } from '@/shared/i18n';
import { useSuperApp } from '@/shared/super-app';
import { BottomSheet, Button, IconButton, useToast } from '@/shared/ui';
import { introVariantFor, manualOnboarding, useManualOnboarding } from '../model/manual-onboarding';
import { useMeasureSession, type MeasureMode, type MeasureSession } from '../model/use-measure-session';
import { ManualIntro } from './manual-intro';
import { MeasurementHistory } from './measurement-history';
import { BusyStatus, MeasuringStatus, ProblemStatus, ResultStatus, UnsyncedBadge } from './measure-status';
import { RssiInputForm } from './rssi-input-form';
import './measure-sheet.css';

export interface MeasureSheetProps {
  contractId: string;
  location: MeasurementLocation;
  /** `measure` starts right away; `view` shows the latest result + history ("Đo lại và xem lịch sử"). */
  mode: MeasureMode;
  /** P1-02 plan speed for the SPEED method (null → latency only). */
  planDownloadMbps: number | null | undefined;
  /** P5-01 ONT MAC for the BSSID check (DK-02, DK-05). */
  modemMac: string | null | undefined;
  /** Active SSID for the iPhone guide copy; `null` → generic text. */
  ssid: string | null;
  onClose: () => void;
  onRename: (location: MeasurementLocation) => void;
  onDelete: (location: MeasurementLocation) => void;
}

/**
 * Measure sheet of one location (P2-03, P2-04, P2-06). Mount it only while open: unmounting
 * (closing) aborts a running measurement without saving.
 */
export function MeasureSheet({
  contractId,
  location,
  mode,
  planDownloadMbps,
  modemMac,
  ssid,
  onClose,
  onRename,
  onDelete,
}: MeasureSheetProps) {
  const { t } = useTranslation('survey');
  const toast = useToast();
  const session = useMeasureSession({
    contractId,
    locationId: location.locationId,
    mode,
    planDownloadMbps,
    modemMac,
    onSaved: (level: SignalLevel) =>
      toast.show(t('measure.savedToast', { name: location.name, level: t(`level.${level}`) })),
  });
  const busy = ['checking', 'measuring', 'saving'].includes(session.phase.name);
  const showHistory = !['manual-intro', 'manual-input'].includes(session.phase.name);

  return (
    <BottomSheet open onClose={onClose} title={location.name} closeLabel={t('measure.close')}>
      <div className="measure-sheet">
        <div className="measure-sheet__tools">
          <IconButton
            icon={Pencil}
            variant="ghost"
            label={t('measure.rename', { name: location.name })}
            disabled={busy}
            onClick={() => onRename(location)}
          />
          <IconButton
            icon={Trash2}
            variant="ghost"
            label={t('measure.delete', { name: location.name })}
            disabled={busy}
            onClick={() => onDelete(location)}
          />
        </div>
        <MeasureBody session={session} location={location} ssid={ssid} />
        {showHistory && (
          <MeasurementHistory
            contractId={contractId}
            locationId={location.locationId}
            newMeasurementId={session.lastMeasurementId}
          />
        )}
      </div>
    </BottomSheet>
  );
}

function MeasureBody({
  session,
  location,
  ssid,
}: {
  session: MeasureSession;
  location: MeasurementLocation;
  ssid: string | null;
}) {
  const { t } = useTranslation('survey');
  const toMessage = useErrorMessage();
  const bridge = useSuperApp();
  const onboarding = useManualOnboarding();
  const [awaitingStoreReturn, setAwaitingStoreReturn] = useState(false);
  const { phase, setPhase, start } = session;

  // After "Tải trên App Store": coming back to the mini app means the app is probably installed.
  useEffect(() => {
    if (!awaitingStoreReturn) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setAwaitingStoreReturn(false);
      manualOnboarding.markAppInstalled();
      setPhase({ name: 'manual-intro', showFullGuide: false, returnedFromStore: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [awaitingStoreReturn, setPhase]);

  const openAppStore = () => {
    void bridge.openDeeplink(AIRPORT_UTILITY_APP_STORE_URL).catch(() => {
      window.open(AIRPORT_UTILITY_APP_STORE_URL, '_blank', 'noopener');
    });
  };

  const remeasure = (
    <Button fullWidth onClick={start}>
      {t('measure.remeasure')}
    </Button>
  );

  switch (phase.name) {
    case 'preparing':
      return <BusyStatus title={t('measure.preparing')} />;
    case 'checking':
      return <BusyStatus title={t('measure.checking')} />;
    case 'measuring':
      return (
        <>
          <MeasuringStatus startedAt={phase.startedAt} />
          <Button fullWidth disabled>
            {t('measure.remeasure')}
          </Button>
        </>
      );
    case 'saving':
      return (
        <>
          <BusyStatus title={t('measure.saving')} />
          <Button fullWidth disabled>
            {t('measure.remeasure')}
          </Button>
        </>
      );
    case 'view':
      return (
        <>
          <ResultStatus level={location.latestLevel ?? null} measuredAt={location.latestMeasuredAt} />
          <Button fullWidth onClick={start}>
            {location.latestLevel ? t('measure.remeasure') : t('measure.start')}
          </Button>
        </>
      );
    case 'result':
      return (
        <>
          <ResultStatus level={phase.level} measuredAt={phase.measuredAt} reveal>
            {phase.trial && <p className="measure-status__note">{t('measure.trialNote')}</p>}
            {!phase.trial && session.latencyOnly && session.meter?.kind === 'bridge' && (
              <p className="measure-status__note">{t('measure.latencyOnlyNote')}</p>
            )}
          </ResultStatus>
          {remeasure}
        </>
      );
    case 'unsynced':
      return (
        <>
          <ResultStatus level={phase.pending.previewLevel} measuredAt={phase.pending.measuredAt} reveal>
            <UnsyncedBadge label={t('measure.unsynced')} />
            <p className="measure-status__note">{t('measure.unsyncedHint')}</p>
          </ResultStatus>
          <Button fullWidth onClick={session.resend} loading={phase.resending}>
            {t('measure.resend')}
          </Button>
        </>
      );
    case 'condition-failed':
      return (
        <>
          <ProblemStatus
            title={t('measure.conditions.title')}
            message={t(`measure.conditions.${phase.reason}`)}
          />
          <Button fullWidth onClick={start}>
            {t('measure.retry')}
          </Button>
          {phase.reason === 'WRONG_MODEM' && (
            <Button fullWidth variant="secondary" onClick={session.measureTrial}>
              {t('measure.conditions.trial')}
            </Button>
          )}
        </>
      );
    case 'cancelled':
      return (
        <>
          <ProblemStatus
            title={t('measure.cancelled.title')}
            message={t(`measure.cancelled.${phase.reason}`)}
          />
          <Button fullWidth onClick={start}>
            {t('measure.retry')}
          </Button>
        </>
      );
    case 'failed':
      return (
        <>
          <ProblemStatus
            title={t('measure.failed.title')}
            message={
              // R-10 / Q-48: SPEED is rejected with 409 CONFLICT while the plan speed is unknown.
              isApiError(phase.error) && phase.error.code === 'CONFLICT' && session.meter?.kind === 'bridge'
                ? t('measure.failed.planUnknown')
                : toMessage(phase.error)
            }
          />
          <Button fullWidth onClick={start}>
            {t('measure.retry')}
          </Button>
        </>
      );
    case 'manual-intro':
      return (
        <ManualIntro
          variant={phase.showFullGuide ? 'guide-full' : introVariantFor(onboarding)}
          returnedFromStore={phase.returnedFromStore}
          ssid={ssid}
          onDownload={() => {
            setAwaitingStoreReturn(true);
            openAppStore();
          }}
          onHaveApp={() => manualOnboarding.markAppInstalled()}
          onShowGuide={() =>
            setPhase({ name: 'manual-intro', showFullGuide: true, returnedFromStore: false })
          }
          onEnter={() => {
            manualOnboarding.markAppInstalled();
            manualOnboarding.markGuideSeen();
            setPhase({ name: 'manual-input' });
          }}
        />
      );
    case 'manual-input':
      return (
        <RssiInputForm
          thresholds={session.thresholds.rssi}
          ssid={ssid}
          airPortUtility={session.meter?.platform === 'IOS'}
          saving={false}
          onSubmit={session.submitManual}
          onShowGuide={() =>
            setPhase({ name: 'manual-intro', showFullGuide: true, returnedFromStore: false })
          }
          onOpenApp={openAppStore}
        />
      );
  }
}
