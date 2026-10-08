import type { components } from './generated/openapi';

/** Error codes declared by the backend contract (CF §3.2 + MiniApp-specific). */
export type ErrorCode = components['schemas']['ErrorCode'];

export const errorCodes = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'IDEMPOTENCY_KEY_REQUIRED',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'REQUEST_IN_PROGRESS',
  'IDEMPOTENCY_KEY_REUSED',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL',
  'SERVICE_UNAVAILABLE',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_REJECTED',
  'LOCATION_LIMIT_REACHED',
  'DEVICE_NOT_BLOCKABLE',
  'DEVICE_BUSY',
  'DEVICE_OFFLINE',
  'VERIFY_MISMATCH',
] as const satisfies readonly ErrorCode[];

// Compile-time guard: regenerating the contract with a new code fails typecheck until listed here
// (and therefore until the `errors` i18n namespace gets a message for it).
type MissingErrorCode = Exclude<ErrorCode, (typeof errorCodes)[number]>;
const _exhaustive: MissingErrorCode extends never ? true : never = true;
void _exhaustive;

/** Codes produced by the client itself (no server response). */
export const clientErrorCodes = ['NETWORK_ERROR', 'CLIENT_TIMEOUT', 'INVALID_RESPONSE'] as const;
export type ClientErrorCode = (typeof clientErrorCodes)[number];

/** Unknown server codes are kept as plain strings (CF §3.1: handle by HTTP status + retryable). */
export type ApiErrorCode = ErrorCode | ClientErrorCode | (string & {});

export function isKnownErrorCode(code: string): code is ErrorCode {
  return (errorCodes as readonly string[]).includes(code);
}
