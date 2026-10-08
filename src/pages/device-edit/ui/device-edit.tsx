import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useConnectedDeviceQuery } from '@/entities/connected-device';
import { EditDeviceForm } from '@/features/edit-connected-device';
import { isApiError, useErrorMessage } from '@/shared/api';
import { paths } from '@/shared/config/routes';
import { useTranslation } from '@/shared/i18n';
import { EmptyState, SectionError, Skeleton } from '@/shared/ui';
import './device-edit.css';

export interface DeviceEditProps {
  serialNumber: string;
  macAddress: string;
}

export function DeviceEdit({ serialNumber, macAddress }: DeviceEditProps) {
  const { t } = useTranslation('devices');
  const toMessage = useErrorMessage();
  const navigate = useNavigate();
  const location = useLocation();
  const query = useConnectedDeviceQuery(serialNumber, macAddress);
  const device = query.data?.data;

  // Back to the detail page; a deep link without history replaces itself with the detail page.
  const goBack = () =>
    location.key === 'default'
      ? void navigate(paths.deviceDetail(macAddress), { replace: true, viewTransition: true })
      : void navigate(-1);

  if (!device) {
    if (query.isPending) {
      return (
        <div className="device-edit__loading" role="status" aria-busy="true" aria-label={t('detail.loading')}>
          <Skeleton height={64} />
          <Skeleton height={180} />
        </div>
      );
    }
    if (isApiError(query.error) && query.error.status === 404) {
      return (
        <div className="stack">
          <EmptyState>{t('detail.notFound')}</EmptyState>
          <Link className="device-edit__back" to={paths.devices} replace>
            {t('detail.backToList')}
          </Link>
        </div>
      );
    }
    return <SectionError message={toMessage(query.error)} onRetry={() => void query.refetch()} />;
  }

  return <EditDeviceForm serialNumber={serialNumber} device={device} onSaved={goBack} />;
}
