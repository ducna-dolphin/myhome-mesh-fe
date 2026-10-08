import { Eye, EyeOff } from 'lucide-react';
import { useErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { cx, IconButton, useToast } from '@/shared/ui';
import { useRevealedWifiPassword } from '../model/use-revealed-wifi-password';
import './wifi-password-field.css';

export interface WifiPasswordFieldProps {
  serialNumber: string;
  wifiIndex: number;
  className?: string;
}

const MASK = '••••••••';

/** Masked password with an eye button; shows the plain text for 60s (P3-01, purpose VIEW). */
export function WifiPasswordField({ serialNumber, wifiIndex, className }: WifiPasswordFieldProps) {
  const { t } = useTranslation('wifi');
  const toast = useToast();
  const toMessage = useErrorMessage();
  const { password, isPending, reveal, hide } = useRevealedWifiPassword(serialNumber, wifiIndex, {
    onError: (error) => toast.show(toMessage(error), { tone: 'danger' }),
  });
  const visible = password !== null;

  return (
    <div className={cx('wifi-password-field', className)}>
      <span className="wifi-password-field__label">{t('list.passwordLabel')}</span>
      {visible ? (
        <span className="wifi-password-field__value wifi-password-field__value--plain" translate="no">
          {password}
        </span>
      ) : (
        <span className="wifi-password-field__value" aria-label={t('password.masked')} role="img">
          {MASK}
        </span>
      )}
      <IconButton
        icon={visible ? EyeOff : Eye}
        label={visible ? t('password.hide') : t('password.show')}
        variant="ghost"
        className="wifi-password-field__toggle"
        aria-pressed={visible}
        aria-busy={isPending || undefined}
        disabled={isPending}
        onClick={visible ? hide : reveal}
      />
    </div>
  );
}
