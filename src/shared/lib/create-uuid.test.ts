import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUuid } from './create-uuid';
import { useDeadline } from './use-deadline';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createUuid', () => {
  it('uses crypto.randomUUID when available', () => {
    expect(createUuid()).toMatch(UUID_V4);
  });

  it('falls back to getRandomValues in non-secure contexts', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => real.getRandomValues(bytes) });
    expect(createUuid()).toMatch(UUID_V4);
  });
});

describe('useDeadline', () => {
  it('expires after the limit for the same key and resets for a new key', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ id }) => useDeadline(id, 1_000, true), {
      initialProps: { id: 'a' as string | null },
    });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(true);
    rerender({ id: 'b' });
    expect(result.current).toBe(false);
    rerender({ id: null });
    expect(result.current).toBe(false);
  });
});
