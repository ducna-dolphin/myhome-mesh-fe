import { describe, expect, it, vi } from 'vitest';
import { createSessionCache } from '@/shared/super-app';

describe('createSessionCache', () => {
  it('memoizes getSession', async () => {
    const getSession = vi.fn().mockResolvedValue({ locale: 'vi-VN' });
    const cache = createSessionCache({ getSession });

    await Promise.all([cache.getSession(), cache.getSession()]);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed getSession instead of caching the rejection', async () => {
    const getSession = vi
      .fn()
      .mockRejectedValueOnce(new Error('bridge not ready'))
      .mockResolvedValue({ locale: 'en-US' });
    const cache = createSessionCache({ getSession });

    await expect(cache.getSession()).rejects.toThrow('bridge not ready');
    await expect(cache.getSession()).resolves.toEqual({ locale: 'en-US' });
    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
