import { describe, expect, it } from 'vitest';
import {
  commandIdFromLocation,
  commandPollIntervalMs,
  commandPollLimitMs,
  commandSchema,
  isTerminalCommand,
} from './command-model';

describe('command model', () => {
  it('parses commands, tolerating unknown FAILED error codes', () => {
    expect(
      commandSchema.parse({
        commandId: 'c1',
        state: 'FAILED',
        errorCode: 'SOMETHING_NEW',
        retryAfterSec: null,
      }),
    ).toMatchObject({ state: 'FAILED', errorCode: 'SOMETHING_NEW' });
    expect(commandSchema.safeParse({ commandId: 'c1', state: 'DONE' }).success).toBe(false);
  });

  it('treats only CONFIRMED and FAILED as terminal (UNKNOWN is not an error)', () => {
    expect(isTerminalCommand({ state: 'CONFIRMED' })).toBe(true);
    expect(isTerminalCommand({ state: 'FAILED' })).toBe(true);
    expect(isTerminalCommand({ state: 'UNKNOWN' })).toBe(false);
    expect(isTerminalCommand({ state: 'SENT' })).toBe(false);
  });

  it('polls every retryAfterSec, default 2s', () => {
    expect(commandPollIntervalMs({ retryAfterSec: 5 })).toBe(5_000);
    expect(commandPollIntervalMs({ retryAfterSec: null })).toBe(2_000);
    expect(commandPollIntervalMs(undefined)).toBe(2_000);
  });

  it('gives up after 2 minutes, 6 for a reboot', () => {
    expect(commandPollLimitMs('WIFI_UPDATE')).toBe(120_000);
    expect(commandPollLimitMs(undefined)).toBe(120_000);
    expect(commandPollLimitMs('REBOOT')).toBe(360_000);
  });

  it('extracts the command id from Location', () => {
    expect(commandIdFromLocation('/mesh/v1/commands/abc-123')).toBe('abc-123');
    expect(commandIdFromLocation('https://api.myhome.vn/mesh/v1/commands/abc?x=1')).toBe('abc');
    expect(commandIdFromLocation(null)).toBeNull();
  });
});
