import { Clock } from 'lucide-react';
import type { ReadMeta } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { formatTime } from '@/shared/lib';
import { cx } from '../class-names';
import { Icon } from '../icon/icon';
import './stale-notice.css';

export interface StaleNoticeProps {
  /** `meta` of a read response; renders nothing unless `meta.stale` is true (LLD §11.4). */
  meta: ReadMeta | null | undefined;
  className?: string;
}

/** "Cập nhật lúc HH:mm" label for a block served from cache (`meta.stale`). */
export function StaleNotice({ meta, className }: StaleNoticeProps) {
  const { t } = useTranslation('common');
  if (!meta?.stale) return null;
  const time = formatTime(meta.updatedAt);

  return (
    <p className={cx('ui-stale-notice', className)}>
      <Icon icon={Clock} size={14} />
      <span>{time ? t('state.staleAt', { time }) : t('state.staleUnknown')}</span>
    </p>
  );
}
