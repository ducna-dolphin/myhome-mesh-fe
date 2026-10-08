import { useState, type FormEvent } from 'react';
import {
  resolveDeviceIcon,
  useUpdateConnectedDeviceMutation,
  type ConnectedDevice,
  type DeviceIconCode,
  type UpdateConnectedDeviceInput,
} from '@/entities/connected-device';
import { isApiError, useErrorMessage, useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Button, TextField, useToast } from '@/shared/ui';
import { DeviceIconPicker } from './device-icon-picker';
import './edit-device-form.css';

/** TB-07: name up to 32 characters. */
export const DEVICE_NAME_MAX_LENGTH = 32;

export interface EditDeviceFormProps {
  serialNumber: string;
  device: ConnectedDevice;
  /** Runs after the name/icon were saved (caches already updated); the page goes back. */
  onSaved: () => void;
}

/**
 * "Đổi tên/Icon thiết bị" (XD s28, P4-03). An empty name clears the custom name so the modem's
 * name is used again. Saved by MyHome only (no modem command), so the response is final.
 */
export function EditDeviceForm({ serialNumber, device, onSaved }: EditDeviceFormProps) {
  const { t } = useTranslation('devices');
  const toMessage = useErrorMessage();
  const toast = useToast();
  const keys = useIdempotencyKey();
  const mutation = useUpdateConnectedDeviceMutation(serialNumber);
  const initialName = device.name ?? '';
  const initialIcon = resolveDeviceIcon(device);
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<DeviceIconCode>(initialIcon);
  const [serverError, setServerError] = useState<string | null>(null);

  const trimmed = name.trim();
  const nameChanged = trimmed !== initialName.trim();
  const iconChanged = icon !== initialIcon;
  const tooLong = trimmed.length > DEVICE_NAME_MAX_LENGTH;
  const canSave = (nameChanged || iconChanged) && !tooLong && !mutation.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    const input: UpdateConnectedDeviceInput = {};
    if (nameChanged) input.name = trimmed === '' ? null : trimmed;
    if (iconChanged) input.icon = icon;
    setServerError(null);
    mutation.mutate(
      { macAddress: device.macAddress, idempotencyKey: keys.forAction(input), ...input },
      {
        onSuccess: () => {
          keys.renew();
          toast.show(t('edit.saved'));
          onSaved();
        },
        onError: (error) => {
          if (isApiError(error) && error.code === 'VALIDATION_FAILED') setServerError(toMessage(error));
          else toast.show(toMessage(error), { tone: 'danger' });
        },
      },
    );
  };

  let error: string | undefined;
  if (tooLong) error = t('edit.nameTooLong');
  else if (serverError) error = serverError;

  return (
    <form className="edit-device-form" onSubmit={submit} noValidate>
      <div className="card edit-device-form__card">
        <TextField
          label={t('edit.nameLabel')}
          placeholder={device.name ?? t('edit.namePlaceholder')}
          value={name}
          maxLength={DEVICE_NAME_MAX_LENGTH}
          onChange={(event) => {
            setName(event.target.value);
            setServerError(null);
          }}
          helper={trimmed === '' ? t('edit.nameHint') : undefined}
          error={error}
          autoComplete="off"
          trimOnBlur
          disabled={mutation.isPending}
        />
        <DeviceIconPicker value={icon} onChange={setIcon} disabled={mutation.isPending} />
      </div>
      <div className="edit-device-form__footer">
        <Button type="submit" fullWidth disabled={!canSave} loading={mutation.isPending}>
          {t('edit.save')}
        </Button>
      </div>
    </form>
  );
}
