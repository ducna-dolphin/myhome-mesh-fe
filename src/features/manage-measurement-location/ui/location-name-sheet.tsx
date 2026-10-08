import { useState, type FormEvent } from 'react';
import {
  LOCATION_NAME_MAX_LENGTH,
  MAX_MEASUREMENT_LOCATIONS,
  useCreateMeasurementLocationMutation,
  type MeasurementLocation,
} from '@/entities/measurement-location';
import { useErrorMessage, useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { BottomSheet, Button, Chip, TextField, useToast } from '@/shared/ui';
import { isLocationNameTaken, nameErrorFromApi, validateLocationName } from '../model/location-name';
import { useNameErrorMessage } from '../model/use-name-error-message';
import './manage-location.css';

const suggestionKeys = ['livingRoom', 'bedroom', 'kitchen', 'office', 'balcony'] as const;

export interface LocationNameSheetProps {
  contractId: string;
  /** Current grid, for the duplicate check and hiding used suggestions. */
  locations: readonly MeasurementLocation[];
  onClose: () => void;
  /** "Lưu & đo ngay": measure right away, without the location confirm dialog (DK-06). */
  onCreatedAndMeasure: (location: MeasurementLocation) => void;
}

type SaveIntent = 'measure' | 'later';

/** Sheet "Đặt tên vị trí đo" (P2-02, VT-02, VT-03). Mount it only while open. */
export function LocationNameSheet({
  contractId,
  locations,
  onClose,
  onCreatedAndMeasure,
}: LocationNameSheetProps) {
  const { t } = useTranslation('survey');
  const toast = useToast();
  const toApiMessage = useErrorMessage();
  const toNameMessage = useNameErrorMessage();
  const keys = useIdempotencyKey();
  const mutation = useCreateMeasurementLocationMutation(contractId);
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [intent, setIntent] = useState<SaveIntent | null>(null);
  const [serverError, setServerError] = useState<unknown>(null);

  const clientError = validateLocationName(name, locations);
  // "Required" only after a submit; the other rules show while typing.
  // While saving (and after success) the new name is already in the list: do not flag it.
  const settledInput = !mutation.isPending && !mutation.isSuccess;
  const visibleClientError = !settledInput || (clientError === 'REQUIRED' && !submitted) ? null : clientError;
  const serverNameError = nameErrorFromApi(serverError);
  const fieldError = visibleClientError ?? serverNameError;
  const generalError = serverError && !serverNameError ? toApiMessage(serverError) : null;
  const suggestions = suggestionKeys
    .map((key) => t(`name.suggestions.${key}`))
    .filter((suggestion) => !isLocationNameTaken(suggestion, locations));

  const save = (nextIntent: SaveIntent) => {
    setSubmitted(true);
    if (clientError || mutation.isPending) return;
    const trimmed = name.trim().replace(/\s+/g, ' ');
    setIntent(nextIntent);
    setServerError(null);
    mutation.mutate(
      { name: trimmed, idempotencyKey: keys.forAction({ name: trimmed }) },
      {
        onSuccess: (created) => {
          keys.renew();
          if (nextIntent === 'measure') {
            onCreatedAndMeasure(created);
          } else {
            toast.show(t('name.savedToast', { name: created.name }));
            onClose();
          }
        },
        onError: (error) => setServerError(error),
      },
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save('measure');
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('name.sheetTitle')}
      closeLabel={t('name.close')}
      dismissible={!mutation.isPending}
    >
      <form className="location-name-form" onSubmit={handleSubmit} noValidate>
        <TextField
          label={t('name.label')}
          placeholder={t('name.placeholder')}
          value={name}
          maxLength={LOCATION_NAME_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="go"
          trimOnBlur
          data-autofocus
          onChange={(event) => {
            setName(event.target.value);
            setServerError(null);
          }}
          error={fieldError ? toNameMessage(fieldError) : undefined}
        />
        {suggestions.length > 0 && (
          <div className="location-name-form__suggestions">
            <p className="location-name-form__caps" id="location-name-suggestions">
              {t('name.suggestionsTitle')}
            </p>
            <div
              className="location-name-form__chips"
              role="group"
              aria-labelledby="location-name-suggestions"
            >
              {suggestions.map((suggestion) => (
                <Chip
                  key={suggestion}
                  selected={name.trim() === suggestion}
                  onClick={() => {
                    setName(suggestion);
                    setServerError(null);
                  }}
                >
                  {suggestion}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <p className="location-name-form__hint">
          {t('name.hint', { maxLength: LOCATION_NAME_MAX_LENGTH, max: MAX_MEASUREMENT_LOCATIONS })}
        </p>
        {generalError && (
          <p className="location-name-form__error" role="alert">
            {generalError}
          </p>
        )}
        <div className="location-name-form__actions">
          <Button
            type="submit"
            fullWidth
            loading={mutation.isPending && intent === 'measure'}
            disabled={mutation.isPending}
          >
            {t('name.saveAndMeasure')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            loading={mutation.isPending && intent === 'later'}
            disabled={mutation.isPending}
            onClick={() => save('later')}
          >
            {t('name.saveLater')}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
