import { useId } from 'react';
import type { ConnectedDevice } from '@/entities/connected-device';
import { useTranslation } from '@/shared/i18n';
import { Dialog, Switch } from '@/shared/ui';
import { useBlockConnectedDevice } from '../model/use-block-connected-device';
import './block-device-card.css';

export interface BlockDeviceCardProps {
  serialNumber: string;
  device: ConnectedDevice;
}

/**
 * Card "Chặn kết nối Internet" (XD s27). Mesh/AP (`blockable = false`) get an explanation instead
 * of the switch; the phone running the MiniApp cannot block itself.
 */
export function BlockDeviceCard({ serialNumber, device }: BlockDeviceCardProps) {
  const { t } = useTranslation('devices');
  const { t: tCommon } = useTranslation('common');
  const labelId = useId();
  const hintId = useId();
  const block = useBlockConnectedDevice(serialNumber, device);
  const name = device.name ?? t('unnamed');
  const selfLocked = block.isSelf && !block.checked;

  let hint: string | null = null;
  if (!device.blockable) hint = t('block.notBlockable');
  else if (selfLocked) hint = t('block.selfDevice');

  return (
    <section className="card block-device-card" aria-labelledby={labelId}>
      <div className="block-device-card__row">
        <h2 className="block-device-card__label" id={labelId}>
          {t('block.label')}
        </h2>
        {device.blockable && (
          <Switch
            checked={block.checked}
            onCheckedChange={block.requestChange}
            aria-labelledby={labelId}
            aria-describedby={hint ? hintId : undefined}
            disabled={selfLocked}
            pending={block.phase === 'sending'}
          />
        )}
      </div>
      {hint && (
        <p className="block-device-card__hint" id={hintId}>
          {hint}
        </p>
      )}
      {block.phase !== 'idle' && (
        <p className="block-device-card__status" role="status">
          {t(block.phase === 'waiting' ? 'block.waiting' : 'block.sending')}
        </p>
      )}
      <Dialog
        open={block.confirmOpen}
        onClose={block.cancelConfirm}
        title={t('block.confirmTitle')}
        description={t('block.confirmDescription', { name })}
        cancelLabel={tCommon('action.cancel')}
        confirmLabel={t('block.confirm')}
        onConfirm={block.confirmBlock}
        destructive
      />
    </section>
  );
}
