import { Trash2 } from 'lucide-react';
import type { ConnectedDevice } from '@/entities/connected-device';
import { useTranslation } from '@/shared/i18n';
import { Dialog, Icon, ListRow, SpecNote } from '@/shared/ui';
import { useRemoveConnectedDevice } from '../model/use-remove-connected-device';
import './remove-device-row.css';

export interface RemoveDeviceRowProps {
  serialNumber: string;
  device: ConnectedDevice;
  /** Runs after the modem confirmed; the page navigates back to the list. */
  onRemoved: () => void;
}

/** Red row "Xoá thiết bị khỏi kết nối" + destructive confirm (XD s27). Hidden for Mesh/AP. */
export function RemoveDeviceRow({ serialNumber, device, onRemoved }: RemoveDeviceRowProps) {
  const { t } = useTranslation('devices');
  const { t: tCommon } = useTranslation('common');
  const removal = useRemoveConnectedDevice(serialNumber, device, onRemoved);
  const name = device.name ?? t('unnamed');

  if (!device.blockable) return null;

  return (
    <div className="card remove-device">
      <ListRow
        className="remove-device__row"
        icon={<Icon icon={Trash2} />}
        iconTone="danger"
        title={t('remove.label')}
        tone="danger"
        chevron={false}
        onClick={removal.open}
        disabled={removal.isSelf || removal.phase !== 'idle'}
      />
      {removal.isSelf && <p className="remove-device__note">{t('block.selfDevice')}</p>}
      {removal.phase === 'waiting' && (
        <p className="remove-device__note remove-device__note--waiting" role="status">
          {t('remove.waiting')}
        </p>
      )}
      <Dialog
        open={removal.confirmOpen}
        onClose={removal.close}
        title={t('remove.confirmTitle')}
        description={t('remove.confirmDescription', { name })}
        cancelLabel={tCommon('action.cancel')}
        confirmLabel={t('remove.confirm')}
        onConfirm={removal.confirm}
        confirmLoading={removal.phase === 'sending'}
        destructive
      >
        <SpecNote id="deviceRemoval" />
      </Dialog>
    </div>
  );
}
