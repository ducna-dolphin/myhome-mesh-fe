import { WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { ONT_DEVICE_FIELD_TARGETS, useOntDeviceQuery, type OntDevice } from '@/entities/ont-device';
import { RebootOntBanner, RebootOntButton, RebootOntDialog, useRebootOnt } from '@/features/reboot-ont';
import { RenameOntField } from '@/features/rename-ont';
import { hasPartialError, isApiError, type PartialError } from '@/shared/api';
import type { PendingSpecNoteId } from '@/shared/config/pending-spec-notes';
import { useTranslation } from '@/shared/i18n';
import { Badge, Button, Icon, SectionError, Skeleton, SpecNote, StaleNotice, cx } from '@/shared/ui';
import { RequireSerialNumber } from '@/widgets/contract-scope';
import { formatTemperature, formatTrafficGb, splitUptimeSec } from '../lib/format-ont-values';
import './modem-tab-page.css';

/** Tab "Modem" of the Internet screen: the contract's single ONT (P5-01…P5-03, XD Modem 4). */
export function ModemTabPage() {
  const { t } = useTranslation('internet');

  return (
    <section className="stack">
      <h2 className="sr-only">{t('tabs.modem')}</h2>
      <RequireSerialNumber>
        {({ serialNumber }) => <OntPanel key={serialNumber} serialNumber={serialNumber} />}
      </RequireSerialNumber>
    </section>
  );
}

type FieldKey = keyof typeof ONT_DEVICE_FIELD_TARGETS;

function OntPanel({ serialNumber }: { serialNumber: string }) {
  const { t } = useTranslation('modem');
  const query = useOntDeviceQuery(serialNumber);
  // Resumes a reboot still running after reopening the app (P0-04); invalidates device + last check.
  const reboot = useRebootOnt(serialNumber, { resumeActive: true });

  if (query.isPending) {
    return (
      <div className="modem-tab" aria-busy="true">
        <Skeleton height={64} />
        <Skeleton height={280} />
      </div>
    );
  }

  if (query.isError) {
    if (isApiError(query.error) && query.error.code === 'DEVICE_OFFLINE') {
      return (
        <div className="modem-tab">
          <div className="modem-offline" role="alert">
            <Icon icon={WifiOff} size={28} />
            <strong className="modem-offline__title">{t('offline.title')}</strong>
            <p className="modem-offline__hint">{t('offline.hint')}</p>
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              {t('offline.retry')}
            </Button>
          </div>
        </div>
      );
    }
    return <SectionError onRetry={() => void query.refetch()} />;
  }

  const { data: device, meta, errors } = query.data;

  return (
    <div className="modem-tab">
      <div className="modem-card">
        <div className="modem-card__header">
          <div className="modem-card__heading">
            <h3 className="modem-card__title">{device.displayName}</h3>
            <Badge>{t('deviceType')}</Badge>
          </div>
          <RebootOntButton controller={reboot} />
        </div>
        {device.modelName && device.modelName !== device.displayName && (
          <p className="modem-card__model">{device.modelName}</p>
        )}
      </div>

      <RebootOntBanner controller={reboot} />

      <section className="modem-card" aria-labelledby="modem-info-title">
        <div className="modem-card__section-head">
          <h3 className="modem-card__section-title" id="modem-info-title">
            {t('infoTitle')}
          </h3>
          <StaleNotice meta={meta} />
        </div>
        {errors.length > 0 && (
          <SectionError message={t('partialError')} onRetry={() => void query.refetch()} />
        )}
        <dl className="modem-info">
          <InfoRow label={t('field.displayName')}>
            <RenameOntField serialNumber={serialNumber} displayName={device.displayName} />
          </InfoRow>
          <DeviceRows device={device} errors={errors} />
        </dl>
      </section>

      <RebootOntDialog controller={reboot} />
    </div>
  );
}

function DeviceRows({ device, errors }: { device: OntDevice; errors: PartialError[] }) {
  const { t } = useTranslation('modem');
  const empty = t('empty');

  /** "—" when the value is null or its source failed in `errors[]` (P5-01, CF §2.2). */
  const valueOf = <K extends FieldKey>(field: K, format: (value: NonNullable<OntDevice[K]>) => string) => {
    const value = device[field];
    if (value === null || value === undefined) return empty;
    if (hasPartialError({ errors }, ONT_DEVICE_FIELD_TARGETS[field])) return empty;
    return format(value as NonNullable<OntDevice[K]>);
  };

  const uptime = valueOf('uptimeSec', (seconds) => {
    const parts = splitUptimeSec(seconds);
    return parts.days > 0 ? t('value.uptime', { ...parts }) : t('value.uptimeShort', { ...parts });
  });
  const traffic = valueOf('totalTrafficBytes', (bytes) =>
    t('value.traffic', { value: formatTrafficGb(bytes) }),
  );
  const temperature = valueOf('temperatureCelsius', (celsius) =>
    t('value.temperature', { value: formatTemperature(celsius) }),
  );

  return (
    <>
      <InfoRow label={t('field.macAddress')}>{valueOf('macAddress', String)}</InfoRow>
      <InfoRow label={t('field.wanIpAddress')}>{valueOf('wanIpAddress', String)}</InfoRow>
      <InfoRow label={t('field.firmwareVersion')}>{valueOf('firmwareVersion', String)}</InfoRow>
      <InfoRow label={t('field.uptime')} note="modemUptime" nowrap>
        {uptime}
      </InfoRow>
      <InfoRow label={t('field.totalTraffic')} note="modemTotalTraffic">
        {traffic}
      </InfoRow>
      <InfoRow label={t('field.temperature')} note="modemTemperature">
        {temperature}
      </InfoRow>
    </>
  );
}

function InfoRow({
  label,
  note,
  nowrap = false,
  children,
}: {
  label: string;
  note?: PendingSpecNoteId;
  /** Keeps a short multi-word value ("3 ngày 09g33p") on one line; the row wraps instead. */
  nowrap?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="modem-info__row">
      <dt className="modem-info__label">
        {label}
        {note && <SpecNote id={note} />}
      </dt>
      <dd className={cx('modem-info__value', nowrap && 'modem-info__value--nowrap')}>{children}</dd>
    </div>
  );
}
