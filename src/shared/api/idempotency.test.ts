import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createIdempotencyKey, createIdempotencyKeyHolder, useIdempotencyKey } from './idempotency';

describe('idempotency keys', () => {
  it('creates UUIDv4 keys', () => {
    expect(createIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(createIdempotencyKey()).not.toBe(createIdempotencyKey());
  });

  it('reuses the key when the same action is retried', () => {
    const holder = createIdempotencyKeyHolder();
    const first = holder.forAction({ wifiIndex: 0, patch: { enabled: false } });
    expect(holder.forAction({ wifiIndex: 0, patch: { enabled: false } })).toBe(first);
  });

  it('creates a new key for a different action or after renew()', () => {
    const holder = createIdempotencyKeyHolder();
    const first = holder.forAction({ name: 'Phòng khách' });
    const second = holder.forAction({ name: 'Phòng ngủ' });
    expect(second).not.toBe(first);
    holder.renew();
    expect(holder.forAction({ name: 'Phòng ngủ' })).not.toBe(second);
  });

  it('keeps the holder stable across renders', () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const key = result.current.forAction();
    rerender();
    expect(result.current.forAction()).toBe(key);
  });
});
