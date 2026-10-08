import { describe, expect, it } from 'vitest';
import { formatDateOnly, formatFixedDecimal } from './format-locale-values';

describe('format-locale-values', () => {
  it('formats date-only and offset datetime strings by their written calendar date', () => {
    expect(formatDateOnly('2026-09-05', 'vi')).toBe('05/09/2026');
    expect(formatDateOnly('2026-09-05T23:30:00+07:00', 'vi')).toBe('05/09/2026');
  });

  it('formats decimals with the locale separator and fixed precision', () => {
    expect(formatFixedDecimal(485.62, 'vi')).toBe('485,62');
    expect(formatFixedDecimal(12, 'vi')).toBe('12,00');
  });
});
