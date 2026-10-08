import { describe, expect, it } from 'vitest';
import { defaultLocale, resolveLocale } from './i18n-instance';

describe('resolveLocale', () => {
  it('normalizes Vietnamese regional locales', () => {
    expect(resolveLocale('vi-VN')).toBe('vi');
    expect(resolveLocale('vi_VN')).toBe('vi');
  });

  it('falls back to Vietnamese for unsupported locales', () => {
    expect(resolveLocale('en-US')).toBe(defaultLocale);
    expect(resolveLocale()).toBe(defaultLocale);
  });
});
