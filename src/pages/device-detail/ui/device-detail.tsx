import { Pencil } from 'lucide-react';
import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DeviceIcon,
  DeviceStatusLabel,
  resolveDeviceIcon,
  useConnectedDeviceQuery,
  type ConnectedDevice,
} from '@/entities/connected-device';
import { BlockDeviceCard } from '@/features/block-connected-device';
import { RemoveDeviceRow } from '@/features/remove-connected-device';
import { isApiError, useErrorMessage } from '@/shared/api';
import { paths } from '@/shared/config/routes';
import { useTranslation } from '@/shared/i18n';
import { EmptyState, IconButton, SectionError, Skeleton, StaleNotice, cx } from '@/shared/ui';
import './device-detail.css';

export interface DeviceDetailProps {
  serialNumber: string;
  macAddress: string;
}

/** Header + "Thông tin thiết bị" + block switch + remove row (P4-01..P4-03). */
export function DeviceDetail({ serialNumber, macAddress }: DeviceDetailProps) {
  const { t } = useTranslation('devices');
  const toMessage = useErrorMessage();
  const navigate = useNavigate();
  const query = useConnectedDeviceQuery(serialNumber, macAddress);
  const device = query.data?.data;
  const onRemoved = useCallback(
    () => void navigate(paths.devices, { replace: true, viewTransition: true }),
    [navigate],
  );

  if (!device) {
    if (query.isPending) {
      return (
        <div
          className="device-detail__loading"
          role="status"
          aria-busy="true"
          aria-label={t('detail.loading')}
        >
          <Skeleton height={88} />
          <Skeleton height={140} />
          <Skeleton height={56} />
        </div>
      );
    }
    if (isApiError(query.error) && query.error.status === 404) {
      return (
        <div className="stack">
          <EmptyState>{t('detail.notFound')}</EmptyState>
          <Link className="device-detail__back" to={paths.devices} replace>
            {t('detail.backToList')}
          </Link>
        </div>
      );
    }
    return <SectionError message={toMessage(query.error)} onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="device-detail">
      <StaleNotice meta={query.data?.meta} />
      {query.isError && (
        <SectionError message={toMessage(query.error)} onRetry={() => void query.refetch()} />
      )}
      <section className="card device-detail__card">
        <DeviceHeader
          device={device}
          onEdit={() => void navigate(paths.deviceEdit(device.macAddress), { viewTransition: true })}
        />
        <DeviceInfo device={device} />
      </section>
      <BlockDeviceCard serialNumber={serialNumber} device={device} />
      <RemoveDeviceRow serialNumber={serialNumber} device={device} onRemoved={onRemoved} />
    </div>
  );
}

function DeviceHeader({ device, onEdit }: { device: ConnectedDevice; onEdit: () => void }) {
  const { t } = useTranslation('devices');
  const blocked = device.status === 'BLOCKED';
  return (
    <div className="device-detail__header">
      <span
        className={cx('device-detail__icon', blocked && 'device-detail__icon--blocked')}
        aria-hidden="true"
      >
        <DeviceIcon icon={resolveDeviceIcon(device)} />
      </span>
      <div className="device-detail__identity">
        <h2 className={cx('device-detail__name', blocked && 'device-detail__name--blocked')}>
          {device.name ?? t('unnamed')}
        </h2>
        <span className="device-detail__mac">{device.macAddress}</span>
        <DeviceStatusLabel status={device.status} />
      </div>
      <IconButton icon={Pencil} label={t('detail.edit')} variant="ghost" onClick={onEdit} />
    </div>
  );
}

function DeviceInfo({ device }: { device: ConnectedDevice }) {
  const { t } = useTranslation('devices');
  const { t: tCommon } = useTranslation('common');
  const none = tCommon('state.notAvailable');
  const rows: Array<[string, string]> = [
    [t('detail.kind'), t(`kind.${device.kind}`)],
    [t('detail.macAddress'), device.macAddress],
    [t('detail.ipAddress'), device.ipAddress ?? none],
    // G-09 / M-19: OneGate has no per-device SSID, show "Wi-Fi" / "Có dây" instead.
    [t('detail.connectedVia'), device.connectionType ? t(`connectionType.${device.connectionType}`) : none],
  ];

  return (
    <div className="device-detail__info">
      <h3 className="device-detail__info-title">{t('detail.infoTitle')}</h3>
      <dl className="device-detail__list">
        {rows.map(([label, value]) => (
          <div key={label} className="device-detail__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
