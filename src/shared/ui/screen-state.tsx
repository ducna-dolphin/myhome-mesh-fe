import type { PropsWithChildren, ReactNode } from 'react';
import { ApiError, type ApiErrorKind } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Icon, type LucideIcon } from './icon/icon';
import './screen-state.css';

const errorMessageKeys = {
  unauthorized: 'error.unauthorized',
  forbidden: 'error.forbidden',
  'not-found': 'error.notFound',
  timeout: 'error.timeout',
  'device-offline': 'error.deviceOffline',
  validation: 'error.validation',
  server: 'error.server',
  network: 'error.network',
} as const satisfies Record<ApiErrorKind, string>;

export function LoadingState() {
  const { t } = useTranslation('common');
  return (
    <div className="screen-state" role="status">
      {t('state.loading')}
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  error?: unknown;
  onRetry?: () => void;
  /** Inline variant for errors inside cards/forms instead of full-screen states. */
  compact?: boolean;
}

export function ErrorState({ message, error, onRetry, compact = false }: ErrorStateProps) {
  const { t } = useTranslation('common');
  const resolvedMessage =
    message ?? (error instanceof ApiError ? t(errorMessageKeys[error.kind]) : t('state.genericError'));

  return (
    <div
      className={`screen-state screen-state--error${compact ? ' screen-state--compact' : ''}`}
      role="alert"
    >
      <p>{resolvedMessage}</p>
      {onRetry && (
        <button className="text-button" type="button" onClick={onRetry}>
          {t('action.retry')}
        </button>
      )}
    </div>
  );
}

export interface EmptyStateProps extends PropsWithChildren {
  /** Illustration glyph in a soft round badge. */
  icon?: LucideIcon;
  /** Next step, e.g. a `<Button size="sm">` that clears a filter. */
  action?: ReactNode;
}

/** "Nothing here yet": what belongs here, plus the first action when there is one. */
export function EmptyState({ icon, action, children }: EmptyStateProps) {
  return (
    <div className={icon || action ? 'screen-state screen-state--empty' : 'screen-state'}>
      {icon && (
        <span className="screen-state__icon" aria-hidden="true">
          <Icon icon={icon} size={24} />
        </span>
      )}
      <p>{children}</p>
      {action}
    </div>
  );
}
