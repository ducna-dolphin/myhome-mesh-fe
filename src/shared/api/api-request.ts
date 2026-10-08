import type { z } from 'zod';
import { clientVersion, env } from '@/shared/config/env';
import { createUuid } from '@/shared/lib/create-uuid';
import { superApp } from '@/shared/super-app';
import { ApiError, kindForCode, mapStatusToKind } from './api-error';
import {
  errorBodySchema,
  partialErrorsSchema,
  readMetaSchema,
  type PartialError,
  type ReadMeta,
} from './envelope';
import { createTokenManager, type TokenManager } from './token-manager';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type RequestContentType = 'application/json' | 'application/merge-patch+json';

export interface ApiRequestOptions<S extends z.ZodTypeAny> {
  /** Path below the API base URL, e.g. `/mesh/v1/devices/SN1`. */
  path: string;
  method?: HttpMethod;
  /** Zod schema for `data` inside the `{ data, meta?, errors? }` envelope. */
  schema: S;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  contentType?: RequestContentType;
  /** One key per user action; reuse it when retrying the same action (CF §2.3). */
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ApiResult<T> {
  status: number;
  data: T;
  meta: ReadMeta | null;
  errors: PartialError[];
  /** `Location` header (201 resource, 202 command). */
  location: string | null;
  /** `Idempotent-Replayed: true` — the server returned the stored result of the same key. */
  replayed: boolean;
}

export interface ApiClientDeps {
  baseUrl: string;
  tokens: TokenManager;
  /** Called when a request is still 401 after one token refresh (LLD §11.4 → closeMiniApp). */
  onUnauthorized: () => void | Promise<void>;
  fetch?: typeof fetch;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function buildUrl(baseUrl: string, path: string, query: ApiRequestOptions<z.ZodTypeAny>['query']): string {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function toApiError(response: Response, requestId: string): Promise<ApiError> {
  const parsed = errorBodySchema.safeParse(await readJson(response));
  const headerRetryAfter = parseRetryAfter(response.headers.get('Retry-After'));
  const headerTraceId = response.headers.get('X-Request-Id') ?? requestId;

  if (!parsed.success) {
    // Not a CF error body (proxy page, empty body): fall back to the HTTP status.
    return new ApiError(
      mapStatusToKind(response.status),
      response.status,
      `HTTP ${response.status}`,
      undefined,
      {
        code: `HTTP_${response.status}`,
        retryable: response.status >= 500,
        retryAfterSec: headerRetryAfter,
        traceId: headerTraceId,
      },
    );
  }

  const { error } = parsed.data;
  return new ApiError(
    kindForCode(error.code, response.status),
    response.status,
    error.message ?? error.code,
    undefined,
    {
      code: error.code,
      retryable: error.retryable ?? response.status >= 500,
      retryAfterSec: error.retryAfterSec ?? headerRetryAfter,
      traceId: error.traceId ?? headerTraceId,
      details: error.details,
    },
  );
}

/** Builds a CF-compliant API client (CF §1.3, §2, §3; LLD §11.4). */
export function createApiClient(deps: ApiClientDeps) {
  const fetchImpl = (...args: Parameters<typeof fetch>) => (deps.fetch ?? fetch)(...args);

  // Single flight: concurrent 401s close the MiniApp once. A failed close may be tried again.
  let closing: Promise<void> | null = null;
  const closeOnUnauthorized = () => {
    closing ??= Promise.resolve()
      .then(() => deps.onUnauthorized())
      .catch(() => {
        closing = null;
      });
    return closing;
  };

  return async function apiRequest<S extends z.ZodTypeAny>(
    options: ApiRequestOptions<S>,
  ): Promise<ApiResult<z.infer<S>>> {
    const controller = new AbortController();
    const onCancel = () => controller.abort();
    options.signal?.addEventListener('abort', onCancel, { once: true });
    if (options.signal?.aborted) controller.abort();
    const timeout = setTimeout(onCancel, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const obtainToken = async (pending: Promise<string>) => {
        try {
          return await untilAborted(pending, controller.signal);
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') throw error;
          throw new ApiError('unauthorized', null, 'Unable to obtain a MiniApp token.', error, {
            code: 'UNAUTHENTICATED',
            retryable: false,
          });
        }
      };

      let token = await obtainToken(deps.tokens.getToken());
      const url = buildUrl(deps.baseUrl, options.path, options.query);

      for (let attempt = 0; ; attempt += 1) {
        const requestId = createUuid();
        const headers = new Headers({
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Request-Id': requestId,
          'X-Client-Version': clientVersion,
        });
        if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
        if (options.body !== undefined)
          headers.set('Content-Type', options.contentType ?? 'application/json');

        const response = await fetchImpl(url, {
          method: options.method ?? 'GET',
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });

        if (response.status === 401 && attempt === 0) {
          // LLD §3.6: get a new token through the bridge and retry exactly once.
          try {
            token = await obtainToken(deps.tokens.refresh(token));
          } catch (error) {
            // LLD §11.4: no new token after a 401 → the session is over, close the MiniApp.
            if (error instanceof ApiError) void closeOnUnauthorized();
            throw error;
          }
          continue;
        }

        if (!response.ok) {
          const error = await toApiError(response, requestId);
          if (response.status === 401) void closeOnUnauthorized();
          throw error;
        }

        const envelope = (await readJson(response)) as Record<string, unknown> | undefined;
        const data = options.schema.safeParse(envelope?.data);
        const meta = readMetaSchema.nullable().optional().safeParse(envelope?.meta);
        const errors = partialErrorsSchema.optional().safeParse(envelope?.errors);
        if (!envelope || !('data' in envelope) || !data.success || !meta.success || !errors.success) {
          throw new ApiError(
            'validation',
            response.status,
            'API response did not match the expected envelope/schema.',
            data.success ? (meta.success ? errors.error : meta.error) : data.error,
            { code: 'INVALID_RESPONSE', retryable: false, traceId: requestId },
          );
        }

        return {
          status: response.status,
          data: data.data as z.infer<S>,
          meta: meta.data ?? null,
          errors: errors.data ?? [],
          location: response.headers.get('Location'),
          replayed: response.headers.get('Idempotent-Replayed') === 'true',
        };
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (options.signal?.aborted) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('timeout', null, 'API request timed out.', error, { code: 'CLIENT_TIMEOUT' });
      }
      throw new ApiError('network', null, 'Unable to reach the API.', error, { code: 'NETWORK_ERROR' });
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onCancel);
    }
  };
}

/** Process-wide MiniApp token (memory only), obtained through the bridge. */
export const miniAppTokens = createTokenManager({ fetchToken: () => superApp.getMiniAppToken() });

/** Default client: MiniApp token from the bridge, `closeMiniApp` on a persistent 401. */
export const apiRequest = createApiClient({
  baseUrl: env.VITE_API_BASE_URL,
  tokens: miniAppTokens,
  onUnauthorized: () => superApp.closeMiniApp(),
});

/** Test helper: forget the cached token between tests. */
export function resetApiAuth(): void {
  miniAppTokens.clear();
}
