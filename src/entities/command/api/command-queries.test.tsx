import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command } from '@/shared/api';
import { createMockCommand, MOCK_CONTRACTS } from '@/shared/api/mock';
import { advanceFakeTime, createQueryWrapper, installFakeClock } from '@/shared/test';
import { commandApi } from './command-api';
import { commandKeys } from './command-keys';
import { useActiveCommands, useCommandPoller } from './command-queries';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;

const flush = advanceFakeTime;

beforeEach(() => {
  installFakeClock();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useCommandPoller', () => {
  it('is idle without a command id', () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCommandPoller(null), { wrapper });
    expect(result.current).toEqual({ command: null, status: 'idle', isTimedOut: false });
  });

  it('polls every retryAfterSec until CONFIRMED and calls onSettled once', async () => {
    const seed = createMockCommand({ type: 'WIFI_UPDATE', serialNumber: SERIAL });
    const get = vi.spyOn(commandApi, 'get');
    const onSettled = vi.fn();
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useCommandPoller(seed.commandId, { initialCommand: seed, onSettled }),
      {
        wrapper,
      },
    );

    expect(result.current.status).toBe('polling');
    expect(result.current.command?.state).toBe('SENT');
    await flush(0);
    expect(get).not.toHaveBeenCalled(); // waits retryAfterSec before the first poll

    await flush(2_200);
    expect(get).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('confirmed');
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled.mock.calls[0]?.[0]).toMatchObject({ commandId: seed.commandId, state: 'CONFIRMED' });

    await flush(10_000);
    expect(get).toHaveBeenCalledTimes(1); // stopped
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('keeps polling through UNKNOWN (not an error) and reports FAILED', async () => {
    const states: Command['state'][] = ['UNKNOWN', 'UNKNOWN', 'FAILED'];
    vi.spyOn(commandApi, 'get').mockImplementation(async (commandId) => {
      const state = states.shift() ?? 'FAILED';
      return { commandId, state, retryAfterSec: 1, errorCode: state === 'FAILED' ? 'VERIFY_MISMATCH' : null };
    });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCommandPoller('cmd-1'), { wrapper });

    await flush(0);
    expect(result.current.command?.state).toBe('UNKNOWN');
    expect(result.current.status).toBe('polling');
    await flush(2_500);
    expect(result.current.status).toBe('failed');
    expect(result.current.command?.errorCode).toBe('VERIFY_MISMATCH');
  });

  it('gives up after 2 minutes with status timeout', async () => {
    const seed = createMockCommand({ type: 'WIFI_UPDATE', serialNumber: SERIAL, settleAfterMs: 10 * 60_000 });
    const get = vi.spyOn(commandApi, 'get');
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCommandPoller(seed.commandId, { initialCommand: seed }), {
      wrapper,
    });

    await flush(119_000);
    expect(result.current.status).toBe('polling');
    await flush(1_000);
    expect(result.current.status).toBe('timeout');
    expect(result.current.isTimedOut).toBe(true);
    const calls = get.mock.calls.length;
    await flush(10_000);
    expect(get.mock.calls.length).toBe(calls);
  });

  it('allows a reboot 6 minutes', async () => {
    const seed = createMockCommand({ type: 'REBOOT', serialNumber: SERIAL, settleAfterMs: 5 * 60_000 });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useCommandPoller(seed.commandId, { type: 'REBOOT', initialCommand: seed }),
      {
        wrapper,
      },
    );

    await flush(3 * 60_000);
    expect(result.current.status).toBe('polling');
    await flush(2 * 60_000 + 3_000);
    expect(result.current.status).toBe('confirmed');
  });

  it('does not poll a command that is already CONFIRMED (200 "already done")', async () => {
    const seed = createMockCommand({ type: 'CLIENT_BLOCK', serialNumber: SERIAL, immediate: true });
    const get = vi.spyOn(commandApi, 'get');
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCommandPoller(seed.commandId, { initialCommand: seed }), {
      wrapper,
    });
    await flush(5_000);
    expect(result.current.status).toBe('confirmed');
    expect(get).not.toHaveBeenCalled();
  });
});

describe('useActiveCommands', () => {
  it('lists running commands of the device', async () => {
    const running = createMockCommand({ type: 'REBOOT', serialNumber: SERIAL });
    createMockCommand({ type: 'CLIENT_BLOCK', serialNumber: SERIAL, immediate: true });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useActiveCommands(SERIAL), { wrapper });
    await flush(0);
    expect(result.current.data?.map((command) => command.commandId)).toEqual([running.commandId]);
  });

  it('is disabled without a serial number', () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useActiveCommands(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('scopes keys by device', () => {
    expect(commandKeys.active('SN1')).toEqual(['device', 'SN1', 'commands', 'active']);
    expect(commandKeys.detail('c1')).toEqual(['command', 'c1']);
  });
});
