import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockCommand, getMockCommand, isMockDeviceBusy, resetMockCommands } from './mock-command-store';

afterEach(() => {
  vi.useRealTimers();
  resetMockCommands();
});

describe('mock command store', () => {
  it('settles to the forced outcome and keeps UNKNOWN non-terminal', () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const created = createMockCommand({
      type: 'WIFI_UPDATE',
      serialNumber: 'SN1',
      outcome: 'UNKNOWN',
      settleAfterMs: 1_000,
      apply,
    });
    expect(created.state).toBe('SENT');

    vi.advanceTimersByTime(1_000);
    const view = getMockCommand(created.commandId!);
    expect(view).toMatchObject({ state: 'UNKNOWN', errorCode: null });
    expect(view?.retryAfterSec).toBeGreaterThan(0);
    expect(apply).not.toHaveBeenCalled();
    expect(isMockDeviceBusy('SN1')).toBe(true);
  });

  it('applies the side effect once CONFIRMED', () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const created = createMockCommand({ type: 'REBOOT', serialNumber: 'SN1', settleAfterMs: 10, apply });
    vi.advanceTimersByTime(10);
    expect(getMockCommand(created.commandId!)?.state).toBe('CONFIRMED');
    getMockCommand(created.commandId!);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
