import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAST_TAB_STORAGE_KEY, readLastTab, writeLastTab } from './last-tab-storage';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('last tab storage', () => {
  it('round-trips a tab path and ignores non-tab values', () => {
    writeLastTab('/modem');
    expect(readLastTab()).toBe('/modem');
    writeLastTab('/wifi/1/edit');
    expect(readLastTab()).toBe('/modem');
    window.localStorage.setItem(LAST_TAB_STORAGE_KEY, 'garbage');
    expect(readLastTab()).toBeNull();
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => writeLastTab('/wifi')).not.toThrow();
    expect(readLastTab()).toBeNull();
  });
});
