import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Globe,
  MinusCircle,
  MonitorSmartphone,
  Wifi,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { HealthCheckItem } from '@/entities/health-check';
import { useTranslation } from '@/shared/i18n';
import { cx, Icon, Spinner } from '@/shared/ui';
import { presentHealthItem, type HealthTone } from '../lib/health-check-presentation';
import './health-check-item-card.css';

const itemIcons = {
  INTERNET_LINE: Globe,
  WIFI_SIGNAL: Wifi,
  CONNECTED_DEVICES: MonitorSmartphone,
} as const satisfies Record<HealthCheckItem['itemType'], LucideIcon>;

const toneIcons: Record<HealthTone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertCircle,
  danger: XCircle,
  neutral: MinusCircle,
};

export interface HealthCheckItemCardProps {
  item: HealthCheckItem;
  /** Action button(s) under the result (Reset Modem, Báo hỏng, Bật Wi-Fi, Đặt lắp thêm Mesh). */
  action?: ReactNode;
  /** Makes the whole card a button (devices item → Devices tab, BR-71). */
  onOpen?: () => void;
}

/** One "Kết quả kiểm tra" card (XD Chatluong 6–7). Copy follows SRC-HEALTH-SCRIPT §3. */
export function HealthCheckItemCard({ item, action, onOpen }: HealthCheckItemCardProps) {
  const { t } = useTranslation('quality');
  const view = presentHealthItem(item);
  const detail = view.detail ? t(`detail.${view.detail.key}`, view.detail.params) : null;

  let line: ReactNode;
  if (view.stateKey) {
    line = (
      <span className={cx('health-item__line', 'health-item__line--neutral')}>
        {view.stateKey === 'RUNNING' && <Spinner size={14} />}
        {view.stateKey === 'FAILED' && <Icon icon={MinusCircle} size={14} />}
        {t(`state.${view.stateKey}`)}
      </span>
    );
  } else if (view.statusKey) {
    line = (
      <>
        <span className={cx('health-item__line', `health-item__line--${view.tone}`)}>
          <Icon icon={toneIcons[view.tone]} size={14} />
          <span>
            <span className="health-item__status">{t(`status.${view.statusKey}`)}</span>
            {detail && !view.detailOnNewLine && <span className="health-item__detail">, {detail}</span>}
          </span>
        </span>
        {detail && view.detailOnNewLine && <span className="health-item__hint">{detail}</span>}
      </>
    );
  } else {
    line = (
      <span className={cx('health-item__line', `health-item__line--${view.tone}`)}>
        {view.tone === 'warning' && <Icon icon={toneIcons.warning} size={14} />}
        <span className={view.tone === 'warning' ? undefined : 'health-item__detail'}>{detail}</span>
      </span>
    );
  }

  const body = (
    <>
      <span className={cx('health-item__icon', `health-item__icon--${view.tone}`)} aria-hidden="true">
        <Icon icon={itemIcons[item.itemType]} />
      </span>
      <span className="health-item__body">
        <span className="health-item__title">{t(`item.${item.itemType}`)}</span>
        {line}
      </span>
    </>
  );

  return (
    <article
      className={cx(
        'health-item',
        item.state === 'PENDING' && 'health-item--pending',
        item.state === 'DONE' && 'health-item--done',
      )}
    >
      {onOpen ? (
        <button type="button" className="health-item__row health-item__row--button" onClick={onOpen}>
          {body}
          <Icon icon={ChevronRight} className="health-item__chevron" />
        </button>
      ) : (
        <div className="health-item__row">{body}</div>
      )}
      {action && <div className="health-item__action">{action}</div>}
    </article>
  );
}
