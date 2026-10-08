import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error';
import { shouldRetryQuery } from './should-retry-query';

const err = (
  status: number | null,
  info: ConstructorParameters<typeof ApiError>[4] = {},
  kind: ApiError['kind'] = 'server',
) => new ApiError(kind, status, 'x', undefined, info);

describe('shouldRetryQuery', () => {
  it('retries transient failures up to twice', () => {
    expect(shouldRetryQuery(0, err(null, {}, 'network'))).toBe(true);
    expect(shouldRetryQuery(1, err(503, { code: 'UPSTREAM_UNAVAILABLE', retryable: true }))).toBe(true);
    expect(shouldRetryQuery(2, err(null, {}, 'network'))).toBe(false);
    expect(shouldRetryQuery(0, new Error('unknown'))).toBe(true);
  });

  it('never auto-retries when the server asks to wait, or on 409/429 and other 4xx', () => {
    expect(shouldRetryQuery(0, err(503, { retryable: true, retryAfterSec: 10 }))).toBe(false);
    expect(shouldRetryQuery(0, err(429, { retryable: true }))).toBe(false);
    expect(shouldRetryQuery(0, err(409, { code: 'DEVICE_OFFLINE' }, 'device-offline'))).toBe(false);
    expect(shouldRetryQuery(0, err(404, { code: 'NOT_FOUND' }, 'not-found'))).toBe(false);
    expect(shouldRetryQuery(0, err(502, { code: 'UPSTREAM_REJECTED', retryable: false }))).toBe(false);
  });

  it('keeps retrying legacy timeouts', () => {
    expect(shouldRetryQuery(0, err(408, {}, 'timeout'))).toBe(true);
  });
});
