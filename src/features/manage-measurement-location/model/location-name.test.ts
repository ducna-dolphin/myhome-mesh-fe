import { describe, expect, it } from 'vitest';
import type { MeasurementLocation } from '@/entities/measurement-location';
import { ApiError } from '@/shared/api';
import { nameErrorFromApi, validateLocationName } from './location-name';

const locations: MeasurementLocation[] = [
  { locationId: 'a', name: 'Phòng khách' },
  { locationId: 'b', name: 'Bếp' },
];

describe('validateLocationName (VT-02)', () => {
  it('trims, requires a value and limits to 30 characters', () => {
    expect(validateLocationName('   ', locations)).toBe('REQUIRED');
    expect(validateLocationName('x'.repeat(31), locations)).toBe('TOO_LONG');
    expect(validateLocationName('  Ban công  ', locations)).toBeNull();
    expect(validateLocationName('<b>', locations)).toBe('INVALID_CHARACTERS');
  });

  it('rejects duplicates case-insensitively, except the location being renamed', () => {
    expect(validateLocationName('phòng KHÁCH ', locations)).toBe('DUPLICATE');
    expect(validateLocationName('Phòng  khách', locations)).toBe('DUPLICATE');
    expect(validateLocationName('Phòng khách', locations, 'a')).toBeNull();
  });
});

describe('nameErrorFromApi', () => {
  const validation = (code: string) =>
    new ApiError('validation', 400, 'invalid', undefined, {
      code: 'VALIDATION_FAILED',
      details: [{ field: 'name', code }],
    });

  it('maps 409 LOCATION_LIMIT_REACHED and 400 name details', () => {
    expect(
      nameErrorFromApi(new ApiError('server', 409, 'limit', undefined, { code: 'LOCATION_LIMIT_REACHED' })),
    ).toBe('LIMIT_REACHED');
    expect(nameErrorFromApi(validation('DUPLICATE'))).toBe('DUPLICATE');
    expect(nameErrorFromApi(validation('TOO_LONG'))).toBe('TOO_LONG');
  });

  it('returns null for errors that do not belong to the field', () => {
    expect(nameErrorFromApi(new ApiError('network', null, 'offline'))).toBeNull();
    expect(nameErrorFromApi(validation('SOMETHING_ELSE'))).toBeNull();
    expect(nameErrorFromApi(new Error('x'))).toBeNull();
  });
});
