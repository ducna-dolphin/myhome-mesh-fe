import { AlertCircle } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { cx } from '../class-names';
import { Icon } from '../icon/icon';
import './section-error.css';

export interface SectionErrorProps {
  /** Defaults to the generic "this block failed" copy. */
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Inline failure of one block while the rest of the screen still renders, e.g. a partial
 * `errors[]` entry whose `target` matches the block (LLD §11.4, CF §2.2).
 */
export function SectionError({ message, onRetry, className }: SectionErrorProps) {
  const { t } = useTranslation('common');
  return (
    <div className={cx('ui-section-error', className)} role="alert">
      <Icon icon={AlertCircle} size={18} />
      <span className="ui-section-error__message">{message ?? t('state.sectionError')}</span>
      {onRetry && (
        <button type="button" className="ui-section-error__retry" onClick={onRetry}>
          {t('action.retry')}
        </button>
      )}
    </div>
  );
}
