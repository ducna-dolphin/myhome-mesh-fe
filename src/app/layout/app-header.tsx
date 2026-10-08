import { ArrowLeft, X } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { IconButton } from '@/shared/ui';

type AppHeaderProps =
  | { variant: 'root'; title: string; onClose: () => void }
  | { variant: 'sub'; title: string; onBack: () => void };

/** 64px header: "Internet" + round X on tabs, back arrow + title on sub-pages. */
export function AppHeader(props: AppHeaderProps) {
  const { t } = useTranslation('common');

  return (
    <header className={`app-header app-header--${props.variant}`}>
      {props.variant === 'sub' && (
        <IconButton icon={ArrowLeft} label={t('action.back')} variant="ghost" onClick={props.onBack} />
      )}
      <h1 className="app-header__title">{props.title}</h1>
      {props.variant === 'root' && <IconButton icon={X} label={t('action.close')} onClick={props.onClose} />}
    </header>
  );
}
