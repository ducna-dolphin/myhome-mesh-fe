import { useTranslation } from '@/shared/i18n';
import { cx } from '@/shared/ui';
import type { ConnectedDeviceStatus } from '../model/connected-device-schema';
import './device-status-label.css';

export interface DeviceStatusLabelProps {
  status: ConnectedDeviceStatus;
  className?: string;
}

/** Status dot + label: "Đang kết nối" (green), "Không hoạt động" (grey), "Đã chặn" (red). */
export function DeviceStatusLabel({ status, className }: DeviceStatusLabelProps) {
  const { t } = useTranslation('devices');
  return (
    <span className={cx('device-status', `device-status--${status.toLowerCase()}`, className)}>
      <span className="device-status__dot" aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  );
}
