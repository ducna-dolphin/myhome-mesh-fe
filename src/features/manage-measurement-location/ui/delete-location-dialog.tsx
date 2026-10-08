import { Trans } from 'react-i18next';
import {
  useDeleteMeasurementLocationMutation,
  type MeasurementLocation,
} from '@/entities/measurement-location';
import { useErrorMessage, useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Dialog, useToast } from '@/shared/ui';

export interface DeleteLocationDialogProps {
  contractId: string;
  location: MeasurementLocation;
  onClose: () => void;
  /** Called right after confirming (the tile disappears optimistically). */
  onDeleted?: (location: MeasurementLocation) => void;
}

/**
 * Destructive confirm "Xoá vị trí?" (P2-05, VT-06): deletes the location and all its history.
 * Optimistic removal; on error the tile comes back and a toast explains. Mount only while open.
 */
export function DeleteLocationDialog({
  contractId,
  location,
  onClose,
  onDeleted,
}: DeleteLocationDialogProps) {
  const { t } = useTranslation('survey');
  const toast = useToast();
  const toMessage = useErrorMessage();
  const keys = useIdempotencyKey();
  const mutation = useDeleteMeasurementLocationMutation(contractId);

  const confirm = () => {
    const { locationId, name } = location;
    // `mutateAsync` settles even after this dialog unmounts (per-call callbacks of `mutate` would not).
    mutation.mutateAsync({ locationId, idempotencyKey: keys.forAction({ locationId }) }).then(
      () => toast.show(t('delete.toast', { name })),
      (error: unknown) =>
        toast.show(t('delete.failed', { name, reason: toMessage(error) }), { tone: 'danger' }),
    );
    onDeleted?.(location);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('delete.title')}
      description={
        <Trans
          t={t}
          i18nKey="delete.description"
          values={{ name: location.name }}
          components={{ b: <strong /> }}
        />
      }
      confirmLabel={t('delete.confirm')}
      cancelLabel={t('delete.cancel')}
      destructive
      onConfirm={confirm}
    />
  );
}
