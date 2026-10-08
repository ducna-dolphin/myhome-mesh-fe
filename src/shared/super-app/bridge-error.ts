export const bridgeErrorCodes = ['BRIDGE_UNSUPPORTED', 'PERMISSION_DENIED', 'TIMEOUT', 'FAILED'] as const;

export type BridgeErrorCode = (typeof bridgeErrorCodes)[number];

export class BridgeError extends Error {
  constructor(
    readonly code: BridgeErrorCode,
    readonly method: string,
    override readonly cause?: unknown,
  ) {
    super(`Bridge call "${method}" failed: ${code}`);
    this.name = 'BridgeError';
  }
}

export function isBridgeError(error: unknown): error is BridgeError {
  return error instanceof BridgeError;
}

function isBridgeErrorCode(value: unknown): value is BridgeErrorCode {
  return typeof value === 'string' && (bridgeErrorCodes as readonly string[]).includes(value);
}

/** Normalizes anything a host handler throws into a `BridgeError`. */
export function toBridgeError(method: string, error: unknown): BridgeError {
  if (error instanceof BridgeError) return error;
  if (error && typeof error === 'object' && 'code' in error && isBridgeErrorCode(error.code)) {
    return new BridgeError(error.code, method, error);
  }
  return new BridgeError('FAILED', method, error);
}
