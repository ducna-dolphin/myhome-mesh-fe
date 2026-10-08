import { Pencil } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { renameOntDeviceInputSchema, useRenameOntDeviceMutation } from '@/entities/ont-device';
import { useErrorMessage, useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Button, IconButton, TextField, useToast } from '@/shared/ui';
import './rename-ont-field.css';

export const ONT_NAME_MAX_LENGTH = 32;

interface RenameOntFieldProps {
  serialNumber: string;
  displayName: string;
}

/**
 * "Tên modem" value with a pencil button; editing swaps in an inline field (P5-03, MD-03).
 * Name is 1–32 characters after trimming (proposed, M-14); stored in MyHome only.
 */
export function RenameOntField({ serialNumber, displayName }: RenameOntFieldProps) {
  const { t } = useTranslation('modem');
  const toMessage = useErrorMessage();
  const toast = useToast();
  const keys = useIdempotencyKey();
  const mutation = useRenameOntDeviceMutation(serialNumber);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(displayName);
  const [error, setError] = useState<string | null>(null);

  const startEditing = () => {
    mutation.reset();
    setValue(displayName);
    setError(null);
    setEditing(true);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = renameOntDeviceInputSchema.safeParse({ displayName: value });
    if (!parsed.success) {
      setError(value.trim().length === 0 ? t('rename.required') : t('rename.tooLong'));
      return;
    }
    if (parsed.data.displayName === displayName) {
      setEditing(false);
      return;
    }
    setError(null);
    mutation.mutate(
      { ...parsed.data, idempotencyKey: keys.forAction(parsed.data) },
      {
        onSuccess: () => {
          keys.renew();
          setEditing(false);
          toast.show(t('rename.success'));
        },
        onError: (mutationError) => setError(toMessage(mutationError)),
      },
    );
  };

  if (!editing) {
    return (
      <span className="rename-ont__value">
        <span className="rename-ont__name">{displayName}</span>
        <IconButton icon={Pencil} label={t('rename.edit')} variant="ghost" onClick={startEditing} />
      </span>
    );
  }

  return (
    <form className="rename-ont__form" onSubmit={submit} noValidate>
      <TextField
        label={t('rename.label')}
        value={value}
        maxLength={ONT_NAME_MAX_LENGTH}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        error={error ?? undefined}
        disabled={mutation.isPending}
        trimOnBlur
        autoFocus
      />
      <div className="rename-ont__actions">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={mutation.isPending}>
          {t('rename.cancel')}
        </Button>
        <Button type="submit" size="sm" loading={mutation.isPending}>
          {t('rename.save')}
        </Button>
      </div>
    </form>
  );
}
