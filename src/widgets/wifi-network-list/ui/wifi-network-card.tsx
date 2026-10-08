import { ChevronRight, Wifi, WifiOff } from 'lucide-react';
import type { CSSProperties, MouseEvent } from 'react';
import type { PendingWifiCommand, WifiNetwork } from '@/entities/wifi-network';
import { WifiPasswordField } from '@/features/reveal-wifi-password';
import { useTranslation } from '@/shared/i18n';
import { Badge, cx, Icon, Spinner } from '@/shared/ui';

interface WifiNetworkCardProps {
  serialNumber: string;
  /** Network with the in-flight command applied (optimistic). */
  network: WifiNetwork;
  pending: PendingWifiCommand | undefined;
  onOpen: () => void;
  /** List position, for the first-load stagger. */
  index?: number;
}

/** One SSID of "Danh sách Wi-fi": the whole card opens the options sheet; the eye button reveals. */
export function WifiNetworkCard({ serialNumber, network, pending, onOpen, index = 0 }: WifiNetworkCardProps) {
  const { t } = useTranslation('wifi');
  const { ssid, enabled, band, wifiIndex } = network;

  let status = (
    <span className={cx('wifi-card__status', enabled ? 'is-on' : 'is-off')}>
      <span className="wifi-card__dot" aria-hidden="true" />
      {enabled ? t('enabled') : t('disabled')}
    </span>
  );
  if (pending) {
    status = (
      <span className="wifi-card__status is-applying" role="status">
        {!pending.awaitingConfirmation && <Spinner size={12} />}
        {pending.awaitingConfirmation ? t('list.awaitingConfirmation') : t('list.applying')}
      </span>
    );
  }

  // A tap anywhere on the card (password row included) opens the options; only the eye button and
  // other controls keep their own action. Keyboard and screen readers use the stretched button.
  const openFromCard = (event: MouseEvent<HTMLLIElement>) => {
    if ((event.target as Element).closest('button, a, input')) return;
    onOpen();
  };

  return (
    <li
      className={cx('wifi-card', !enabled && 'is-disabled')}
      style={{ '--i': index } as CSSProperties}
      onClick={openFromCard}
    >
      <span className="wifi-card__icon" aria-hidden="true">
        <Icon icon={enabled ? Wifi : WifiOff} />
      </span>
      <div className="wifi-card__body">
        <div className="wifi-card__heading">
          <h4 className="wifi-card__ssid" translate="no">
            {ssid}
          </h4>
          <Badge tone="neutral">{t(`band.${band}`)}</Badge>
        </div>
        {status}
        <WifiPasswordField
          serialNumber={serialNumber}
          wifiIndex={wifiIndex}
          className="wifi-card__password"
        />
      </div>
      <button
        type="button"
        className="wifi-card__open"
        aria-label={t('list.openOptions', { ssid })}
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        <Icon icon={ChevronRight} className="wifi-card__chevron" />
      </button>
    </li>
  );
}
