import { delay, HttpResponse } from 'msw';
import { createUuid } from '@/shared/lib/create-uuid';
import type { components } from '../generated/openapi';

export type Schemas = components['schemas'];
type ErrorBody = Schemas['ErrorResponse']['error'];

/** MSW path matcher for an API path, independent of `VITE_API_BASE_URL`. */
export const apiPath = (path: string) => `*${path}`;

/** Simulated latency in the browser; tests run without delay. */
export async function mockDelay(ms = 250): Promise<void> {
  if (import.meta.env.MODE === 'test') return;
  await delay(ms);
}

interface OkInit {
  status?: 200 | 201 | 202;
  meta?: Schemas['ReadMeta'];
  errors?: Schemas['PartialErrors'];
  headers?: Record<string, string>;
}

/** Success envelope `{ data, meta?, errors? }` (CF §2.2). */
export function ok<T>(data: T, init: OkInit = {}) {
  const body: Record<string, unknown> = { data };
  if (init.meta) body.meta = init.meta;
  if (init.errors?.length) body.errors = init.errors;
  return HttpResponse.json(body, { status: init.status ?? 200, headers: init.headers });
}

const defaultRetryable: Partial<Record<Schemas['ErrorCode'], boolean>> = {
  TOKEN_EXPIRED: true,
  REQUEST_IN_PROGRESS: true,
  RATE_LIMITED: true,
  SERVICE_UNAVAILABLE: true,
  UPSTREAM_UNAVAILABLE: true,
  UPSTREAM_TIMEOUT: true,
  DEVICE_BUSY: true,
};

/** Error envelope `{ error }` (CF §3.1). */
export function apiError(
  status: number,
  code: Schemas['ErrorCode'],
  extra: Partial<Pick<ErrorBody, 'retryable' | 'retryAfterSec' | 'details' | 'message'>> = {},
) {
  const error: ErrorBody = {
    code,
    message: extra.message ?? `Mock ${code}`,
    traceId: createUuid().replace(/-/g, ''),
    retryable: extra.retryable ?? defaultRetryable[code] ?? false,
    ...(extra.retryAfterSec !== undefined ? { retryAfterSec: extra.retryAfterSec } : {}),
    ...(extra.details ? { details: extra.details } : {}),
  };
  const headers: Record<string, string> = { 'X-Request-Id': error.traceId };
  if (extra.retryAfterSec !== undefined) headers['Retry-After'] = String(extra.retryAfterSec);
  return HttpResponse.json({ error } satisfies Schemas['ErrorResponse'], { status, headers });
}

export const nowIso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
