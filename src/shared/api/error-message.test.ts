import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/shared/i18n';
import { BridgeError, bridgeErrorCodes } from '@/shared/super-app';
import { ApiError } from './api-error';
import { clientErrorCodes, errorCodes } from './error-codes';
import { getCommandErrorMessageKey, getErrorMessageKey, useErrorMessage } from './error-message';

const serverError = (code: string, status: number, retryable = false) =>
  new ApiError('validation', status, 'dev message', undefined, { code, retryable });

describe('errors namespace', () => {
  it('has a Vietnamese message for every contract ErrorCode, bridge and client code', () => {
    for (const code of errorCodes) expect(i18n.exists(`errors:code.${code}`), code).toBe(true);
    for (const code of bridgeErrorCodes) expect(i18n.exists(`errors:bridge.${code}`), code).toBe(true);
    for (const code of clientErrorCodes) expect(i18n.exists(`errors:client.${code}`), code).toBe(true);
  });
});

describe('getErrorMessageKey', () => {
  it('maps known codes', () => {
    expect(getErrorMessageKey(serverError('DEVICE_OFFLINE', 409))).toBe('code.DEVICE_OFFLINE');
    expect(getErrorMessageKey(serverError('LOCATION_LIMIT_REACHED', 409))).toBe(
      'code.LOCATION_LIMIT_REACHED',
    );
  });

  it('maps bridge and client errors', () => {
    expect(getErrorMessageKey(new BridgeError('PERMISSION_DENIED', 'getWifiInfo'))).toBe(
      'bridge.PERMISSION_DENIED',
    );
    expect(getErrorMessageKey(new ApiError('network', null, 'x'))).toBe('client.NETWORK_ERROR');
    expect(getErrorMessageKey(new ApiError('timeout', null, 'x'))).toBe('client.CLIENT_TIMEOUT');
  });

  it('falls back to HTTP status, then retryable, for unknown codes (CF §3.1)', () => {
    expect(getErrorMessageKey(serverError('NEW_CODE', 409))).toBe('http.409');
    expect(getErrorMessageKey(serverError('NEW_CODE', 507))).toBe('generic.retryLater');
    expect(getErrorMessageKey(serverError('NEW_CODE', 418, true))).toBe('generic.retryLater');
    expect(getErrorMessageKey(serverError('NEW_CODE', 418))).toBe('generic.clientError');
    expect(getErrorMessageKey(new Error('boom'))).toBe('generic.unknown');
  });

  it('maps FAILED command error codes', () => {
    expect(getCommandErrorMessageKey('VERIFY_MISMATCH')).toBe('code.VERIFY_MISMATCH');
    expect(getCommandErrorMessageKey('SOMETHING_NEW')).toBe('generic.unknown');
    expect(getCommandErrorMessageKey(null)).toBe('generic.unknown');
  });

  it('never returns the developer message', () => {
    const { result } = renderHook(() => useErrorMessage());
    const message = result.current(serverError('DEVICE_BUSY', 409));
    expect(message).toBe('Modem đang thực hiện thao tác khác. Vui lòng thử lại sau.');
    expect(message).not.toContain('dev message');
  });
});
