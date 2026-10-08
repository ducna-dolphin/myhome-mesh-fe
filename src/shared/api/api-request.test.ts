import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { clientVersion } from '@/shared/config/env';
import { ApiError } from './api-error';
import { createApiClient } from './api-request';
import { createTokenManager } from './token-manager';

const schema = z.object({ ok: z.boolean() });

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function setup(responses: Array<Response | Error>) {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
    const next = responses.shift();
    if (!next) throw new Error('No more responses');
    if (next instanceof Error) throw next;
    return next;
  });
  let tokenSerial = 0;
  const fetchToken = vi.fn(async () => {
    tokenSerial += 1;
    return { accessToken: `token-${tokenSerial}`, expiresIn: 900 };
  });
  const onUnauthorized = vi.fn();
  const apiRequest = createApiClient({
    baseUrl: 'https://api.test/',
    tokens: createTokenManager({ fetchToken }),
    onUnauthorized,
    fetch: fetchMock as unknown as typeof fetch,
  });
  const headersOf = (call: number) => new Headers(fetchMock.mock.calls[call]?.[1]?.headers);
  return { apiRequest, fetchMock, fetchToken, onUnauthorized, headersOf };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('apiRequest (CF client)', () => {
  it('unwraps the envelope and returns status, meta, errors and Location', async () => {
    const { apiRequest } = setup([
      json(
        202,
        {
          data: { ok: true },
          meta: { source: 'CACHE', updatedAt: '2026-10-08T01:00:00Z', stale: true },
          errors: [{ code: 'UPSTREAM_TIMEOUT', target: 'traffic' }],
        },
        { Location: '/mesh/v1/commands/c-1', 'Idempotent-Replayed': 'true' },
      ),
    ]);

    await expect(apiRequest({ path: '/x', schema })).resolves.toEqual({
      status: 202,
      data: { ok: true },
      meta: { source: 'CACHE', updatedAt: '2026-10-08T01:00:00Z', stale: true },
      errors: [{ code: 'UPSTREAM_TIMEOUT', target: 'traffic' }],
      location: '/mesh/v1/commands/c-1',
      replayed: true,
    });
  });

  it('defaults meta to null and errors to []', async () => {
    const { apiRequest } = setup([json(200, { data: { ok: false } })]);
    await expect(apiRequest({ path: '/x', schema })).resolves.toMatchObject({
      meta: null,
      errors: [],
      location: null,
    });
  });

  it('sends auth, request id, client version, idempotency key and query', async () => {
    const { apiRequest, fetchMock, headersOf } = setup([json(200, { data: { ok: true } })]);
    await apiRequest({
      path: '/mesh/v1/devices/SN/health-checks',
      method: 'POST',
      schema,
      idempotencyKey: 'key-1',
      query: { limit: 1, sort: '-createdAt', skip: undefined },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.test/mesh/v1/devices/SN/health-checks?limit=1&sort=-createdAt',
    );
    const headers = headersOf(0);
    expect(headers.get('Authorization')).toBe('Bearer token-1');
    expect(headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers.get('X-Client-Version')).toBe(clientVersion);
    expect(clientVersion).toMatch(/^miniapp-mesh\/\d+\.\d+\.\d+/);
    expect(headers.get('Idempotency-Key')).toBe('key-1');
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('sends merge-patch bodies with the requested content type', async () => {
    const { apiRequest, fetchMock, headersOf } = setup([json(202, { data: { ok: true } })]);
    await apiRequest({
      path: '/w',
      method: 'PATCH',
      schema,
      body: { enabled: false },
      contentType: 'application/merge-patch+json',
      idempotencyKey: 'k',
    });
    expect(headersOf(0).get('Content-Type')).toBe('application/merge-patch+json');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{"enabled":false}');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH');
  });

  it('uses a new X-Request-Id per request', async () => {
    const { apiRequest, headersOf } = setup([
      json(200, { data: { ok: true } }),
      json(200, { data: { ok: true } }),
    ]);
    await apiRequest({ path: '/a', schema });
    await apiRequest({ path: '/a', schema });
    expect(headersOf(0).get('X-Request-Id')).not.toBe(headersOf(1).get('X-Request-Id'));
  });

  it('maps the CF error envelope to ApiError without exposing it as user copy', async () => {
    const { apiRequest } = setup([
      json(409, {
        error: {
          code: 'DEVICE_BUSY',
          message: 'Another write command is running',
          traceId: 'trace-1',
          retryable: true,
          retryAfterSec: 30,
          details: [{ field: 'ssid', code: 'TOO_LONG' }],
        },
      }),
    ]);
    const error = await apiRequest({ path: '/x', schema }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'DEVICE_BUSY',
      status: 409,
      httpStatus: 409,
      retryable: true,
      retryAfterSec: 30,
      traceId: 'trace-1',
      details: [{ field: 'ssid', code: 'TOO_LONG' }],
      kind: 'validation',
    });
  });

  it('maps DEVICE_OFFLINE to the legacy device-offline kind', async () => {
    const { apiRequest } = setup([
      json(409, { error: { code: 'DEVICE_OFFLINE', message: 'x', traceId: 't', retryable: false } }),
    ]);
    await expect(apiRequest({ path: '/x', schema })).rejects.toMatchObject({
      code: 'DEVICE_OFFLINE',
      kind: 'device-offline',
    });
  });

  it('keeps unknown codes and falls back to Retry-After / X-Request-Id headers', async () => {
    const { apiRequest } = setup([
      json(
        503,
        { error: { code: 'BRAND_NEW_CODE', message: 'x', retryable: true } },
        { 'Retry-After': '12', 'X-Request-Id': 'from-header' },
      ),
    ]);
    await expect(apiRequest({ path: '/x', schema })).rejects.toMatchObject({
      code: 'BRAND_NEW_CODE',
      retryAfterSec: 12,
      traceId: 'from-header',
      kind: 'server',
    });
  });

  it('handles non-CF error bodies by HTTP status', async () => {
    const { apiRequest } = setup([new Response('<html>Bad gateway</html>', { status: 502 })]);
    await expect(apiRequest({ path: '/x', schema })).rejects.toMatchObject({
      code: 'HTTP_502',
      status: 502,
      retryable: true,
    });
  });

  it('gets a new token and retries exactly once after 401', async () => {
    const { apiRequest, fetchMock, fetchToken, onUnauthorized, headersOf } = setup([
      json(401, { error: { code: 'TOKEN_EXPIRED', message: 'x', traceId: 't', retryable: true } }),
      json(200, { data: { ok: true } }),
    ]);
    await expect(apiRequest({ path: '/x', schema, idempotencyKey: 'same' })).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchToken).toHaveBeenCalledTimes(2);
    expect(headersOf(0).get('Authorization')).toBe('Bearer token-1');
    expect(headersOf(1).get('Authorization')).toBe('Bearer token-2');
    // The retry is the same user action: same idempotency key.
    expect(headersOf(1).get('Idempotency-Key')).toBe('same');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('closes the MiniApp when the retry is still 401', async () => {
    const unauthorized = () =>
      json(401, { error: { code: 'UNAUTHENTICATED', message: 'x', traceId: 't', retryable: false } });
    const { apiRequest, fetchMock, onUnauthorized } = setup([unauthorized(), unauthorized()]);
    await expect(apiRequest({ path: '/x', schema })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('closes the MiniApp when no new token can be obtained after a 401', async () => {
    const onUnauthorized = vi.fn();
    const fetchToken = vi
      .fn()
      .mockResolvedValueOnce({ accessToken: 'token-1', expiresIn: 900 })
      .mockRejectedValue(new Error('bridge down'));
    const fetchMock = vi.fn(async () =>
      json(401, { error: { code: 'TOKEN_EXPIRED', message: 'x', traceId: 't', retryable: true } }),
    );
    const apiRequest = createApiClient({
      baseUrl: 'https://api.test',
      tokens: createTokenManager({ fetchToken }),
      onUnauthorized,
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(apiRequest({ path: '/x', schema })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it('closes the MiniApp once for concurrent persistent 401s', async () => {
    const unauthorized = () =>
      json(401, { error: { code: 'UNAUTHENTICATED', message: 'x', traceId: 't', retryable: false } });
    let release: () => void = () => undefined;
    const { apiRequest, onUnauthorized } = setup([
      unauthorized(),
      unauthorized(),
      unauthorized(),
      unauthorized(),
    ]);
    onUnauthorized.mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    const results = await Promise.allSettled([
      apiRequest({ path: '/a', schema }),
      apiRequest({ path: '/b', schema }),
    ]);
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    release();
  });

  it('reports UNAUTHENTICATED when the bridge cannot provide a token', async () => {
    const apiRequest = createApiClient({
      baseUrl: 'https://api.test',
      tokens: createTokenManager({ fetchToken: () => Promise.reject(new Error('bridge down')) }),
      onUnauthorized: vi.fn(),
      fetch: vi.fn() as unknown as typeof fetch,
    });
    await expect(apiRequest({ path: '/x', schema })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: null,
    });
  });

  it('rejects responses that do not match the schema or the envelope', async () => {
    const { apiRequest } = setup([json(200, { data: { ok: 'yes' } }), json(200, { ok: true })]);
    await expect(apiRequest({ path: '/x', schema })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      kind: 'validation',
    });
    await expect(apiRequest({ path: '/x', schema })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('maps fetch failures to NETWORK_ERROR', async () => {
    const { apiRequest } = setup([new TypeError('Failed to fetch')]);
    await expect(apiRequest({ path: '/x', schema })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      kind: 'network',
    });
  });

  it('times out with CLIENT_TIMEOUT', async () => {
    vi.useFakeTimers();
    const apiRequest = createApiClient({
      baseUrl: 'https://api.test',
      tokens: createTokenManager({ fetchToken: async () => ({ accessToken: 't', expiresIn: 900 }) }),
      onUnauthorized: vi.fn(),
      fetch: ((_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })) as unknown as typeof fetch,
    });
    const pending = apiRequest({ path: '/x', schema, timeoutMs: 50 });
    const outcome = expect(pending).rejects.toMatchObject({ code: 'CLIENT_TIMEOUT', kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(50);
    await outcome;
  });

  it('propagates caller cancellation as AbortError', async () => {
    const controller = new AbortController();
    const apiRequest = createApiClient({
      baseUrl: 'https://api.test',
      tokens: createTokenManager({ fetchToken: () => new Promise(() => {}) }),
      onUnauthorized: vi.fn(),
      fetch: vi.fn() as unknown as typeof fetch,
    });
    const pending = apiRequest({ path: '/x', schema, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
