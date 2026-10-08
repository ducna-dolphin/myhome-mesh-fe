import { ApiError } from './api-error';

/**
 * Query retry policy. Network/timeout/5xx failures retry up to twice; responses that carry
 * `retryAfterSec` or are 409/429 never auto-retry (LLD §11.4: show "try later" instead).
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return true;
  if (error.retryAfterSec !== undefined) return false;
  if (error.status === 409 || error.status === 429) return false;
  if (error.status !== null && error.status < 500 && error.kind !== 'timeout') return false;
  return error.retryable;
}
