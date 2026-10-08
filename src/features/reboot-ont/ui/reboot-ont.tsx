import { Power } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { Button, Dialog, Icon, Spinner } from '@/shared/ui';
import type { RebootOntController } from '../model/use-reboot-ont';
import './reboot-ont.css';

interface ControllerProps {
  controller: RebootOntController;
}

/** "Khởi động lại" secondary button of the Modem tab (wireframe 5.1; missing in XD, M-16). */
export function RebootOntButton({ controller }: ControllerProps) {
  const { t } = useTranslation('modem');
  return (
    <Button
      variant="secondary"
      size="sm"
      startIcon={<Icon icon={Power} size={16} />}
      onClick={controller.openDialog}
      loading={controller.isSending}
      disabled={controller.isRebooting}
    >
      {t('reboot.action')}
    </Button>
  );
}

interface RebootOntDialogProps extends ControllerProps {
  /** Defaults to the Modem tab copy (proposed, M-12). */
  title?: string;
  description?: string;
  confirmLabel?: string;
}

/** Confirmation before the reboot: the network drops for about 2 minutes (BR-69, M-12). */
export function RebootOntDialog({ controller, title, description, confirmLabel }: RebootOntDialogProps) {
  const { t } = useTranslation('modem');
  return (
    <Dialog
      open={controller.isDialogOpen}
      onClose={controller.closeDialog}
      title={title ?? t('reboot.confirmTitle')}
      description={description ?? t('reboot.confirmDescription')}
      confirmLabel={confirmLabel ?? t('reboot.confirm')}
      cancelLabel={t('reboot.cancel')}
      onConfirm={controller.confirm}
      confirmLoading={controller.isSending}
    />
  );
}

/** "Đang khởi động lại…" banner while the REBOOT command is being verified. */
export function RebootOntBanner({ controller }: ControllerProps) {
  const { t } = useTranslation('modem');
  if (!controller.isRebooting) return null;
  return (
    <div className="reboot-ont-banner" role="status">
      <Spinner size={18} />
      <div className="reboot-ont-banner__text">
        <strong>{t('reboot.running')}</strong>
        <span>{t('reboot.runningHint')}</span>
      </div>
    </div>
  );
}
