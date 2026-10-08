import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandApi, type Command } from '@/entities/command';
import { wifiNetworkApi, type WifiNetwork } from '@/entities/wifi-network';
import { ApiError } from '@/shared/api';
import { MOCK_CONTRACTS } from '@/shared/api/mock';
import { advanceFakeTime, createQueryWrapper, installFakeClock } from '@/shared/test';
import { ToastProvider } from '@/shared/ui';
import { useEnableWifi } from './use-enable-wifi';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;

const networks: WifiNetwork[] = [
  { wifiIndex: 0, ssid: 'Home_2G', band: 'BAND_2_4GHZ', enabled: false },
  { wifiIndex: 1, ssid: 'Home_5G', band: 'BAND_5GHZ', enabled: false },
  { wifiIndex: 2, ssid: 'Home_Other', band: 'BAND_5GHZ', enabled: true },
];

const sent = (id: string): Command => ({
  commandId: id,
  type: 'WIFI_UPDATE',
  state: 'SENT',
  retryAfterSec: 2,
});

function setup(onDone = vi.fn()) {
  const { wrapper: QueryWrapper } = createQueryWrapper();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryWrapper>
      <ToastProvider>{children}</ToastProvider>
    </QueryWrapper>
  );
  return { onDone, ...renderHook(() => useEnableWifi(SERIAL, { onDone }), { wrapper }) };
}

beforeEach(() => {
  installFakeClock();
  vi.spyOn(wifiNetworkApi, 'list').mockResolvedValue({ data: networks, meta: null, errors: [] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useEnableWifi', () => {
  it('enables disabled networks one at a time, waiting for each command to settle', async () => {
    const update = vi
      .spyOn(wifiNetworkApi, 'update')
      .mockImplementation(async (_serial, wifiIndex) => sent(`cmd-${wifiIndex}`));
    const get = vi.spyOn(commandApi, 'get').mockImplementation(async (commandId) => ({
      ...sent(commandId),
      state: 'CONFIRMED',
      retryAfterSec: null,
    }));
    const { result, onDone } = setup();

    act(() => result.current.run());
    expect(result.current.isRunning).toBe(true);
    await advanceFakeTime(100);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith(
      SERIAL,
      0,
      { enabled: true },
      expect.any(String),
      expect.any(AbortSignal),
    );

    await advanceFakeTime(2_100); // first command confirmed → second PATCH
    expect(get).toHaveBeenCalledWith('cmd-0', expect.anything());
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(
      SERIAL,
      1,
      { enabled: true },
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(onDone).not.toHaveBeenCalled();

    await advanceFakeTime(2_100);
    expect(update).toHaveBeenCalledTimes(2); // enabled network untouched
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.isRunning).toBe(false);
  });

  it('stops on 409 DEVICE_BUSY with retryAfterSec, never auto-retries, and retries manually with a new key', async () => {
    const busy = new ApiError('validation', 409, 'busy', undefined, {
      code: 'DEVICE_BUSY',
      retryAfterSec: 4,
    });
    const update = vi
      .spyOn(wifiNetworkApi, 'update')
      .mockRejectedValueOnce(busy)
      .mockImplementation(async (_serial, wifiIndex) => ({
        commandId: `c-${wifiIndex}`,
        type: 'WIFI_UPDATE',
        state: 'CONFIRMED',
      }));
    const { result, onDone } = setup();

    act(() => result.current.run());
    await advanceFakeTime(100);
    expect(update).toHaveBeenCalledTimes(1);
    expect(result.current.isRunning).toBe(false);
    expect(document.body.textContent).toContain('Modem đang bận. Vui lòng thử lại sau 4 giây.');
    await advanceFakeTime(10_000);
    expect(update).toHaveBeenCalledTimes(1); // the second network is not attempted either
    expect(onDone).not.toHaveBeenCalled();

    act(() => result.current.run());
    await advanceFakeTime(200);
    expect(update).toHaveBeenCalledTimes(3);
    expect(update.mock.calls[1]?.[3]).not.toBe(update.mock.calls[0]?.[3]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('aborts the in-flight PATCH when unmounted', async () => {
    let received: AbortSignal | undefined;
    vi.spyOn(wifiNetworkApi, 'update').mockImplementation(
      (_serial, _index, _patch, _key, signal) =>
        new Promise((_resolve, reject) => {
          received = signal;
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const { result, unmount, onDone } = setup();
    act(() => result.current.run());
    await advanceFakeTime(100);
    expect(received?.aborted).toBe(false);
    unmount();
    expect(received?.aborted).toBe(true);
    await advanceFakeTime(1_000);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('still re-runs the check after a failed command and reports the failure', async () => {
    vi.spyOn(wifiNetworkApi, 'list').mockResolvedValue({ data: [networks[0]!], meta: null, errors: [] });
    vi.spyOn(wifiNetworkApi, 'update').mockResolvedValue({
      commandId: 'c',
      type: 'WIFI_UPDATE',
      state: 'FAILED',
      errorCode: 'VERIFY_MISMATCH',
    });
    const { result, onDone } = setup();
    act(() => result.current.run());
    await advanceFakeTime(200);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('Chưa bật được Wi-Fi. Vui lòng thử lại sau.');
  });

  it('stops polling when unmounted', async () => {
    vi.spyOn(wifiNetworkApi, 'update').mockResolvedValue(sent('c'));
    const get = vi.spyOn(commandApi, 'get').mockResolvedValue(sent('c'));
    const { result, unmount, onDone } = setup();
    act(() => result.current.run());
    await advanceFakeTime(2_100);
    expect(get).toHaveBeenCalledTimes(1);
    unmount();
    await advanceFakeTime(10_000);
    expect(get).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});
