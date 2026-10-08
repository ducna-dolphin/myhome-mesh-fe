import { useCallback } from 'react';
import { LOCATION_NAME_MAX_LENGTH, MAX_MEASUREMENT_LOCATIONS } from '@/entities/measurement-location';
import { useTranslation } from '@/shared/i18n';
import type { LocationNameError } from './location-name';

const keys = {
  REQUIRED: 'name.errors.required',
  TOO_LONG: 'name.errors.tooLong',
  DUPLICATE: 'name.errors.duplicate',
  INVALID_CHARACTERS: 'name.errors.invalidCharacters',
  LIMIT_REACHED: 'name.errors.limitReached',
  NOT_FOUND: 'name.errors.notFound',
} as const satisfies Record<LocationNameError, string>;

export function useNameErrorMessage(): (error: LocationNameError) => string {
  const { t } = useTranslation('survey');
  return useCallback(
    (error) =>
      t(keys[error], { max: error === 'TOO_LONG' ? LOCATION_NAME_MAX_LENGTH : MAX_MEASUREMENT_LOCATIONS }),
    [t],
  );
}
