import { useMeasurementsQuery } from '@/entities/measurement-location';
import { useTranslation } from '@/shared/i18n';
import { formatDateTime } from '@/shared/lib';
import { Badge, cx, SignalBars } from '@/shared/ui';

interface MeasurementHistoryProps {
  contractId: string;
  locationId: string;
  /** Measurement saved in this sheet: tagged "Mới" (LS-04). */
  newMeasurementId: string | null;
}

/**
 * "Lịch sử đo (5 lần gần nhất)", newest first (LS-04). Hidden while it would only repeat the
 * first measurement (LS-05) and on load errors (the result above stays usable).
 */
export function MeasurementHistory({ contractId, locationId, newMeasurementId }: MeasurementHistoryProps) {
  const { t } = useTranslation('survey');
  const { data } = useMeasurementsQuery(contractId, locationId);
  if (!data || data.length < 2) return null;

  return (
    <section className="measure-history" aria-labelledby={`history-${locationId}`}>
      <h3 className="measure-history__title" id={`history-${locationId}`}>
        {t('history.title')} <span className="measure-history__subtitle">{t('history.subtitle')}</span>
      </h3>
      <ul className="measure-history__list">
        {data.slice(0, 5).map((item) => (
          <li key={item.measurementId} className="measure-history__row">
            <SignalBars level={item.level} />
            <span
              className={cx('measure-history__level', `measure-history__level--${item.level.toLowerCase()}`)}
            >
              {t(`level.${item.level}`)}
            </span>
            {item.measurementId === newMeasurementId && <Badge tone="brand">{t('history.new')}</Badge>}
            <span className="measure-history__time">{formatDateTime(item.measuredAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
