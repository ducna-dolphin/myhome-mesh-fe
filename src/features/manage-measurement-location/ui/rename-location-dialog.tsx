import { useState } from 'react';
import {
  LOCATION_NAME_MAX_LENGTH,
  useRenameMeasurementLocationMutation,
  type MeasurementLocation,
} from '@/entities/measurement-location';
import { useErrorMessage, useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Dialog, TextField, useToast } from '@/shared/ui';
import { nameErrorFromApi, validateLocationName } from '../model/location-name';
import { useNameErrorMessage } from '../model/use-name-error-message';
import './manage-location.css';

export interface RenameLocationDialogProps {
  contractId: string;
  location: MeasurementLocation;
  locations: readonly MeasurementLocation[];
  onClose: () => void;
}

/**
 * "Đổi tên vị trí" (P2-05, VT-06): same rules as creation; the history is kept. The tile shows
 * the new name optimistically and rolls back on error. Mount it only while open.
 */
export function RenameLocationDialog({
  contractId,
  location,
  locations,
  onClose,
}: RenameLocationDialogProps) {
  const { t } = useTranslation('survey');
  const toast = useToast();
  const toApiMessage = useErrorMessage();
  const toNameMessage = useNameErrorMessage();
  const keys = useIdempotencyKey();
  const mutation = useRenameMeasurementLocationMutation(contractId);
  const [name, setName] = useState(location.name);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);

  const trimmed = name.trim().replace(/\s+/g, ' ');
  const unchanged = trimmed === location.name;
  const clientError = validateLocationName(name, locations, location.locationId);
  const visibleClientError =
    mutation.isPending || (clientError === 'REQUIRED' && !submitted) ? null : clientError;
  const serverNameError = nameErrorFromApi(serverError);
  const fieldError = visibleClientError ?? serverNameError;
  const generalError = serverError && !serverNameError ? toApiMessage(serverError) : null;

  const confirm = () => {
    setSubmitted(true);
    if (clientError || mutation.isPending) return;
    if (unchanged) {
      onClose();
      return;
    }
    setServerError(null);
    mutation.mutate(
      {
        locationId: location.locationId,
        name: trimmed,
        idempotencyKey: keys.forAction({ locationId: location.locationId, name: trimmed }),
      },
      {
        onSuccess: (renamed) => {
          keys.renew();
          toast.show(t('rename.toast', { name: renamed.name }));
          onClose();
        },
        onError: (error) => setServerError(error),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('rename.title')}
      confirmLabel={t('rename.save')}
      cancelLabel={t('rename.cancel')}
      onConfirm={confirm}
      confirmLoading={mutation.isPending}
    >
      <form
        className="rename-location-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          confirm();
        }}
      >
        <TextField
          label={t('rename.label')}
          value={name}
          maxLength={LOCATION_NAME_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="done"
          trimOnBlur
          data-autofocus="select"
          onChange={(event) => {
            setName(event.target.value);
            setServerError(null);
          }}
          error={fieldError ? toNameMessage(fieldError) : (generalError ?? undefined)}
        />
      </form>
    </Dialog>
  );
}
