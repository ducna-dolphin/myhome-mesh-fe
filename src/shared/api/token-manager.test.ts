import { describe, expect, it, vi } from 'vitest';
import { BridgeError } from '@/shared/super-app';
import { createTokenManager } from './token-manager';

function setup(expiresIn = 900) {
  let now = 1_000_000;
  let serial = 0;
  const fetchToken = vi.fn(async () => {
    serial += 1;
    return { accessToken: `t${serial}`, expiresIn };
  });
  const manager = createTokenManager({ fetchToken, now: () => now });
  return { manager, fetchToken, advance: (ms: number) => (now += ms) };
}

describe('createTokenManager', () => {
  it('caches the token while more than 20% of its lifetime remains', async () => {
    const { manager, fetchToken, advance } = setup(900);
    await expect(manager.getToken()).resolves.toBe('t1');
    advance(719_000); // 181s left of 900s (> 180s = 20%)
    await expect(manager.getToken()).resolves.toBe('t1');
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('refreshes proactively when less than 20% of the lifetime remains', async () => {
    const { manager, fetchToken, advance } = setup(900);
    await manager.getToken();
    advance(721_000); // 179s left
    await expect(manager.getToken()).resolves.toBe('t2');
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('shares one host call between concurrent callers', async () => {
    const { manager, fetchToken } = setup();
    const [a, b, c] = await Promise.all([manager.getToken(), manager.getToken(), manager.refresh()]);
    expect([a, b, c]).toEqual(['t1', 't1', 't1']);
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('forces a new token on refresh, unless the rejected token was already replaced', async () => {
    const { manager, fetchToken } = setup();
    await manager.getToken();
    await expect(manager.refresh('t1')).resolves.toBe('t2');
    // A late 401 for t1 must not trigger another host call: t2 is already cached.
    await expect(manager.refresh('t1')).resolves.toBe('t2');
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures', async () => {
    const fetchToken = vi
      .fn()
      .mockRejectedValueOnce(new Error('bridge not ready'))
      .mockResolvedValue({ accessToken: 'ok', expiresIn: 900 });
    const manager = createTokenManager({ fetchToken });
    await expect(manager.getToken()).rejects.toThrow('bridge not ready');
    await expect(manager.getToken()).resolves.toBe('ok');
  });

  it.each([
    ['null', null],
    ['an empty token', { accessToken: '', expiresIn: 900 }],
    ['a non-positive lifetime', { accessToken: 'x', expiresIn: 0 }],
    ['a fractional lifetime', { accessToken: 'x', expiresIn: 1.5 }],
    ['a string lifetime', { accessToken: 'x', expiresIn: '900' }],
  ])('treats %s from getMiniAppToken as a FAILED bridge call and does not cache it', async (_label, bad) => {
    const fetchToken = vi
      .fn()
      .mockResolvedValueOnce(bad)
      .mockResolvedValue({ accessToken: 'ok', expiresIn: 900 });
    const manager = createTokenManager({ fetchToken });
    const error = await manager.getToken().catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(BridgeError);
    expect(error).toMatchObject({ code: 'FAILED', method: 'getMiniAppToken' });
    await expect(manager.getToken()).resolves.toBe('ok');
  });

  it('clear() forgets the cached token', async () => {
    const { manager, fetchToken } = setup();
    await manager.getToken();
    manager.clear();
    await expect(manager.getToken()).resolves.toBe('t2');
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });
});
