import type { ApiErrorCode } from './error-codes';

/** Coarse error class used by `ScreenState` and query retry; screens prefer `code` via `useErrorMessage`. */
export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'timeout'
  | 'device-offline'
  | 'validation'
  | 'server'
  | 'network';

export interface ApiErrorDetail {
  field?: string;
  code?: string;
  message?: string;
}

export interface ApiErrorInfo {
  code?: ApiErrorCode;
  retryable?: boolean;
  retryAfterSec?: number;
  traceId?: string;
  details?: ApiErrorDetail[];
}

const defaultCodeByKind: Record<ApiErrorKind, ApiErrorCode> = {
  unauthorized: 'UNAUTHENTICATED',
  forbidden: 'FORBIDDEN',
  'not-found': 'NOT_FOUND',
  timeout: 'CLIENT_TIMEOUT',
  'device-offline': 'DEVICE_OFFLINE',
  validation: 'INVALID_RESPONSE',
  server: 'INTERNAL',
  network: 'NETWORK_ERROR',
};

const retryableKinds = new Set<ApiErrorKind>(['network', 'timeout', 'server']);

/**
 * Error raised by the HTTP layer. `message` is for developers only and must never be shown to
 * users; map `code` through the `errors` i18n namespace instead (`getErrorMessageKey`).
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  readonly retryAfterSec: number | undefined;
  readonly traceId: string | undefined;
  readonly details: ApiErrorDetail[];

  constructor(
    readonly kind: ApiErrorKind,
    /** HTTP status, or `null` when no response was received. */
    readonly status: number | null,
    message: string,
    override readonly cause?: unknown,
    info: ApiErrorInfo = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = info.code ?? defaultCodeByKind[kind];
    this.retryable = info.retryable ?? retryableKinds.has(kind);
    this.retryAfterSec = info.retryAfterSec;
    this.traceId = info.traceId;
    this.details = info.details ?? [];
  }

  /** Alias of `status`, matching the CF naming. */
  get httpStatus(): number | null {
    return this.status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Fallback status → kind mapping for non-CF error bodies (any 409 is treated as "device offline"). */
export function mapStatusToKind(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 408) return 'timeout';
  if (status === 409) return 'device-offline';
  if (status >= 500) return 'server';
  return 'validation';
}

/** Kind for CF error envelopes: driven by `code` first, then HTTP status. */
export function kindForCode(code: string, status: number): ApiErrorKind {
  if (code === 'DEVICE_OFFLINE') return 'device-offline';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 429 || status >= 500) return 'server';
  return 'validation';
}
