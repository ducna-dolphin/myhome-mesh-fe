import {
  LOCATION_NAME_MAX_LENGTH,
  locationNameSchema,
  type MeasurementLocation,
} from '@/entities/measurement-location';
import { isApiError } from '@/shared/api';

export type LocationNameError =
  'REQUIRED' | 'TOO_LONG' | 'DUPLICATE' | 'INVALID_CHARACTERS' | 'LIMIT_REACHED' | 'NOT_FOUND';

/** VT-02 duplicate check: trimmed and case-insensitive (LLD §6.3 proposal). */
export function normalizeLocationName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

export function isLocationNameTaken(
  name: string,
  locations: readonly MeasurementLocation[],
  exceptLocationId?: string,
): boolean {
  const normalized = normalizeLocationName(name);
  return locations.some(
    (location) =>
      location.locationId !== exceptLocationId && normalizeLocationName(location.name) === normalized,
  );
}

/** Client-side VT-02 validation; the server checks again (`400 details`, `409`). */
export function validateLocationName(
  name: string,
  locations: readonly MeasurementLocation[],
  exceptLocationId?: string,
): LocationNameError | null {
  const trimmed = name.trim();
  if (!trimmed) return 'REQUIRED';
  if (trimmed.length > LOCATION_NAME_MAX_LENGTH) return 'TOO_LONG';
  if (!locationNameSchema.safeParse(trimmed).success) return 'INVALID_CHARACTERS';
  if (isLocationNameTaken(trimmed, locations, exceptLocationId)) return 'DUPLICATE';
  return null;
}

const detailCodes: Record<string, LocationNameError> = {
  REQUIRED: 'REQUIRED',
  TOO_LONG: 'TOO_LONG',
  DUPLICATE: 'DUPLICATE',
  INVALID_CHARACTERS: 'INVALID_CHARACTERS',
};

/** Server errors that belong under the name field; `null` → show a generic message. */
export function nameErrorFromApi(error: unknown): LocationNameError | null {
  if (!isApiError(error)) return null;
  if (error.code === 'LOCATION_LIMIT_REACHED') return 'LIMIT_REACHED';
  if (error.code === 'NOT_FOUND') return 'NOT_FOUND';
  const detail = error.details.find((item) => item.field === 'name' && item.code && item.code in detailCodes);
  return detail?.code ? detailCodes[detail.code]! : null;
}
