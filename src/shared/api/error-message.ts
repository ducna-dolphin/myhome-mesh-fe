import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type errors from '@/shared/i18n/locales/vi/errors.json';
import { isBridgeError } from '@/shared/super-app';
import { ApiError } from './api-error';
import { clientErrorCodes, isKnownErrorCode, type ClientErrorCode } from './error-codes';

type ErrorsResource = typeof errors;
type Prefixed<Group extends keyof ErrorsResource> =
  `${Group & string}.${keyof ErrorsResource[Group] & string}`;

/** Key inside the `errors` namespace. */
export type ErrorMessageKey =
  | Prefixed<'code'>
  | Prefixed<'client'>
  | Prefixed<'bridge'>
  | Prefixed<'http'>
  | Prefixed<'generic'>
  | Prefixed<'command'>;

const httpStatusKeys = new Set([
  '400',
  '401',
  '403',
  '404',
  '409',
  '413',
  '422',
  '429',
  '500',
  '502',
  '503',
  '504',
]);

function isClientCode(code: string): code is ClientErrorCode {
  return (clientErrorCodes as readonly string[]).includes(code);
}

/**
 * Maps any error to a Vietnamese message key (LLD §11.4, CF §3.1). Never uses `error.message`.
 * Unknown codes fall back to the HTTP status, then to `retryable` (5xx → "try later", 4xx → generic).
 */
export function getErrorMessageKey(error: unknown): ErrorMessageKey {
  if (isBridgeError(error)) return `bridge.${error.code}`;
  if (!(error instanceof ApiError)) return 'generic.unknown';

  if (isKnownErrorCode(error.code)) return `code.${error.code}`;
  if (isClientCode(error.code)) return `client.${error.code}`;

  const status = error.status;
  if (status !== null && httpStatusKeys.has(String(status)))
    return `http.${String(status)}` as ErrorMessageKey;
  if (error.retryable || (status !== null && status >= 500)) return 'generic.retryLater';
  if (status === null) return error.kind === 'timeout' ? 'client.CLIENT_TIMEOUT' : 'client.NETWORK_ERROR';
  return 'generic.clientError';
}

/** Message key for a FAILED command (`Command.errorCode`, P0-04). */
export function getCommandErrorMessageKey(errorCode: string | null | undefined): ErrorMessageKey {
  return errorCode && isKnownErrorCode(errorCode) ? `code.${errorCode}` : 'generic.unknown';
}

/** React helper: `const toMessage = useErrorMessage(); toMessage(error)`. */
export function useErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation('errors');
  return useCallback((error: unknown) => t(getErrorMessageKey(error)), [t]);
}
