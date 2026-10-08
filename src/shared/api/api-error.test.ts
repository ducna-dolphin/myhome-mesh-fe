import { describe, expect, it } from 'vitest';
import { mapStatusToKind } from '@/shared/api';

describe('mapStatusToKind', () => {
  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [408, 'timeout'],
    [409, 'device-offline'],
    [500, 'server'],
  ] as const)('maps %s to %s', (status, kind) => {
    expect(mapStatusToKind(status)).toBe(kind);
  });
});
