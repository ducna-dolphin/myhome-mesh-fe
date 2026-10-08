import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contractApi } from '@/entities/contract';
import { mockServer } from '@/app/mocks/mock-server';
import { superApp } from '@/shared/super-app';

const unauthorized = () =>
  HttpResponse.json(
    { error: { code: 'TOKEN_EXPIRED', message: 'expired', traceId: 't', retryable: true } },
    { status: 401 },
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('default apiRequest with the MyHome bridge', () => {
  it('asks the bridge for a new token after 401 and retries once', async () => {
    const getToken = vi.spyOn(superApp, 'getMiniAppToken');
    const seen: string[] = [];
    let calls = 0;
    mockServer.use(
      http.get('*/link/v1/contract-links', ({ request }) => {
        seen.push(request.headers.get('Authorization') ?? '');
        calls += 1;
        return calls === 1 ? unauthorized() : HttpResponse.json({ data: [] });
      }),
    );

    await expect(contractApi.list()).resolves.toMatchObject({ data: [] });
    expect(getToken).toHaveBeenCalledTimes(2);
    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
  });

  it('closes the MiniApp when the retried request is still 401', async () => {
    const close = vi.spyOn(superApp, 'closeMiniApp').mockResolvedValue(undefined);
    mockServer.use(http.get('*/link/v1/contract-links', unauthorized));

    await expect(contractApi.list()).rejects.toMatchObject({ code: 'TOKEN_EXPIRED', status: 401 });
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });

  it('reuses the in-memory token across requests', async () => {
    const getToken = vi.spyOn(superApp, 'getMiniAppToken');
    await contractApi.list();
    await contractApi.list();
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(window.localStorage.length).toBe(0);
  });
});
