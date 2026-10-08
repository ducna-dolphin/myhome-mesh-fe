import { Check, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from '@/shared/i18n';
import { formatDateTime } from '@/shared/lib';
import { Badge, cx, Icon, SignalBars, type SignalLevel } from '@/shared/ui';
import { MEASURE_DURATION_SEC } from '../model/meters';

const levelTone = { GOOD: 'good', FAIR: 'fair', WEAK: 'weak' } as const;

function StatusIcon({ variant }: { variant: 'busy' | 'done' | 'problem' }) {
  const glyph = variant === 'done' ? Check : variant === 'problem' ? WifiOff : Wifi;
  return (
    <span className={cx('measure-status__icon', `measure-status__icon--${variant}`)} aria-hidden="true">
      <span className="measure-status__icon-inner">
        <Icon icon={glyph} size={24} />
      </span>
    </span>
  );
}

/** Determinate progress over the measurement duration (`durationSec` = 8). */
function useMeasureProgress(startedAt: number, durationMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  return Math.min(100, Math.max(0, Math.round(((now - startedAt) / durationMs) * 100)));
}

export function BusyStatus({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="measure-status" aria-live="polite">
      <StatusIcon variant="busy" />
      <p className="measure-status__title">{title}</p>
      {hint && <p className="measure-status__hint">{hint}</p>}
    </div>
  );
}

/** Signature of the measuring moment: Wi-Fi glyph with radar rings pulsing out of it. */
function MeasureRadar() {
  return (
    <span className="measure-radar" aria-hidden="true">
      <span className="measure-radar__ring" />
      <span className="measure-radar__ring" />
      <span className="measure-radar__ring" />
      <span className="measure-radar__core">
        <Icon icon={Wifi} size={28} />
      </span>
    </span>
  );
}

export function MeasuringStatus({ startedAt }: { startedAt: number }) {
  const { t } = useTranslation('survey');
  const progress = useMeasureProgress(startedAt, MEASURE_DURATION_SEC * 1000);
  return (
    <div className="measure-status" aria-live="polite">
      <MeasureRadar />
      <p className="measure-status__title">{t('measure.running')}</p>
      <p className="measure-status__hint">{t('measure.hint', { seconds: MEASURE_DURATION_SEC })}</p>
      <div
        className="measure-status__progress"
        role="progressbar"
        aria-label={t('measure.progress')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span className="measure-status__progress-fill" style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
    </div>
  );
}

export interface ResultStatusProps {
  level: SignalLevel | null;
  measuredAt: string | null | undefined;
  /** Extra line(s) under the time, e.g. "Chưa đồng bộ" or a trial note. */
  children?: ReactNode;
  /** Fresh result: check pops, bars fill one by one, then the level and time fade in. */
  reveal?: boolean;
}

/** "Chất lượng Wi-fi: <mức>" + time + bars. Never shows speed or dBm (QD-06). */
export function ResultStatus({ level, measuredAt, children, reveal = false }: ResultStatusProps) {
  const { t } = useTranslation('survey');
  const label = t(`level.${level ?? 'NONE'}`);
  return (
    <div className={cx('measure-status', reveal && 'measure-status--reveal')} aria-live="polite">
      <StatusIcon variant={level ? 'done' : 'busy'} />
      <p className="measure-status__title">
        {level ? t('measure.quality', { level: label }) : t('measure.notMeasured')}
      </p>
      {level && (
        <p className={cx('measure-status__level', `measure-status__level--${levelTone[level]}`)}>
          <SignalBars level={level} animated={reveal} />
          <span className="measure-status__level-label">{label}</span>
        </p>
      )}
      {measuredAt && <p className="measure-status__hint">{formatDateTime(measuredAt)}</p>}
      {children}
    </div>
  );
}

export function ProblemStatus({ title, message }: { title: string; message: ReactNode }) {
  return (
    <div className="measure-status" role="alert">
      <StatusIcon variant="problem" />
      <p className="measure-status__title">{title}</p>
      <p className="measure-status__hint">{message}</p>
    </div>
  );
}

export function UnsyncedBadge({ label }: { label: string }) {
  return (
    <Badge tone="warning" className="measure-status__badge">
      {label}
    </Badge>
  );
}
