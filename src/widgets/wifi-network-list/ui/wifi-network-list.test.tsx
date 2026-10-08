import { act, fireEvent, screen, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { wifiNetworkApi } from '@/entities/wifi-network';
import { setWifiNetworkMockOptions } from '@/entities/wifi-network/mock';
import { MOCK_CONTRACTS, setMockScenario } from '@/shared/api/mock';
import { bridgeMethods } from '@/shared/super-app';
import {
  advanceFakeTime,
  createFakeSuperAppClient,
  installFakeClock,
  renderWithProviders,
} from '@/shared/test';
import { WifiNetworkList } from './wifi-network-list';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderList(options: Parameters<typeof renderWithProviders>[1] = {}) {
  return renderWithProviders(
    <>
      <WifiNetworkList serialNumber={SERIAL} />
      <LocationProbe />
    </>,
    { route: '/wifi', ...options },
  );
}

const location = () => screen.getByTestId('location').textContent;
const card = (ssid: string) => screen.getByRole('heading', { name: ssid, level: 4 }).closest('li')!;

/** Waits for the list with real timers; with the fake clock call `advanceFakeTime(0)` instead. */
const listReady = () => screen.findByRole('heading', { name: 'Danh sách Wi-fi (3)' });

function openOptions(ssid: string) {
  fireEvent.click(screen.getByRole('button', { name: `Tuỳ chọn cho ${ssid}` }));
  return screen.getByRole('dialog', { name: ssid });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('WifiNetworkList', () => {
  it('lists every network with band, state and a masked password', async () => {
    renderList();
    expect(await screen.findByRole('heading', { name: 'Danh sách Wi-fi (3)' })).toBeInTheDocument();

    const first = card('MyHome_WF6');
    expect(within(first).getByText('2.4GHz')).toBeInTheDocument();
    expect(within(first).getByText('Đang bật')).toBeInTheDocument();
    expect(within(first).getByRole('img', { name: 'Mật khẩu đang ẩn' })).toHaveTextContent('••••••••');
    expect(within(card('MyHome_5G')).getByText('5GHz')).toBeInTheDocument();
    expect(within(card('MyHome_IoT')).getByText('Đang tắt')).toBeInTheDocument();
    expect(screen.queryByText('MyHome@2024')).not.toBeInTheDocument();
  });

  it('opens the options sheet from anywhere on the card, but not from the eye button', async () => {
    renderList();
    await listReady();
    const first = card('MyHome_WF6');

    fireEvent.click(within(first).getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(location()).toBe('/wifi');

    fireEvent.click(within(first).getByText('Mật khẩu'));
    expect(location()).toBe('/wifi?sheet=wifi-options&wifiIndex=0');
    expect(screen.getByRole('dialog', { name: 'MyHome_WF6' })).toBeInTheDocument();
  });

  it('shows a loading skeleton first', () => {
    renderList();
    expect(screen.getByText('Đang tải danh sách Wi-Fi').closest('[aria-busy]')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('labels data served from cache (meta.stale)', async () => {
    setWifiNetworkMockOptions({ stale: true });
    renderList();
    expect(await screen.findByText(/Cập nhật lúc/)).toBeInTheDocument();
  });

  it('shows the DEVICE_OFFLINE message with retry when the modem is offline', async () => {
    setMockScenario({ device: 'offline' });
    renderList();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Modem đang mất kết nối.');

    setMockScenario({ device: 'online' });
    fireEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('heading', { name: 'Danh sách Wi-fi (3)' })).toBeInTheDocument();
  });

  it('reveals the password for 60s, then masks it and keeps nothing in the cache', async () => {
    installFakeClock();
    const reveal = vi.spyOn(wifiNetworkApi, 'revealPassword');
    const { queryClient } = renderList();
    await advanceFakeTime(0);

    fireEvent.click(within(card('MyHome_WF6')).getByRole('button', { name: 'Hiện mật khẩu' }));
    await advanceFakeTime(0);
    expect(reveal).toHaveBeenCalledWith(SERIAL, 0, 'VIEW');
    expect(within(card('MyHome_WF6')).getByText('MyHome@2024')).toBeInTheDocument();
    expect(within(card('MyHome_WF6')).getByRole('button', { name: 'Ẩn mật khẩu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data),
      ),
    ).not.toContain('MyHome@2024');

    await advanceFakeTime(59_000, 1_000);
    expect(screen.getByText('MyHome@2024')).toBeInTheDocument();
    await advanceFakeTime(1_000);
    expect(screen.queryByText('MyHome@2024')).not.toBeInTheDocument();
    expect(within(card('MyHome_WF6')).getByRole('button', { name: 'Hiện mật khẩu' })).toBeInTheDocument();
  });

  it('hides on demand and wipes the password on unmount', async () => {
    const { unmount, queryClient } = renderList();
    const button = within(
      await screen.findByRole('heading', { name: 'MyHome_5G' }).then((h) => h.closest('li')!),
    ).getByRole('button', { name: 'Hiện mật khẩu' });
    fireEvent.click(button);
    expect(await screen.findByText('MyHome5G@2024')).toBeInTheDocument();

    fireEvent.click(within(card('MyHome_5G')).getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(screen.queryByText('MyHome5G@2024')).not.toBeInTheDocument();

    fireEvent.click(within(card('MyHome_5G')).getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(await screen.findByText('MyHome5G@2024')).toBeInTheDocument();
    unmount();
    expect(document.body).not.toHaveTextContent('MyHome5G@2024');
    await vi.waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('toasts 429 RATE_LIMITED when revealing too often', async () => {
    setWifiNetworkMockOptions({ revealRateLimited: true });
    renderList();
    await screen.findByRole('heading', { name: 'MyHome_WF6' });
    fireEvent.click(within(card('MyHome_WF6')).getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(await screen.findByText('Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.')).toBeInTheDocument();
  });
});

describe('Wi-Fi options sheet', () => {
  it('opens from the card via ?sheet=wifi-options&wifiIndex and closes with back', async () => {
    renderList();
    await listReady();
    const sheet = openOptions('MyHome_WF6');
    expect(location()).toBe('/wifi?sheet=wifi-options&wifiIndex=0');
    expect(within(sheet).getByText('Bật / Tắt Wi-Fi')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Đổi tên / Mật khẩu Wi-Fi' })).toHaveAttribute(
      'href',
      '/wifi/0/edit',
    );
    expect(within(sheet).getByRole('link', { name: 'Chia sẻ Wi-Fi (QR code)' })).toHaveAttribute(
      'href',
      '/wifi/0/share',
    );
    expect(within(sheet).queryByText(/lịch/i)).not.toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole('button', { name: 'Đóng' }));
    await vi.waitFor(() => expect(location()).toBe('/wifi'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens from a deep link and closes by replacing the URL', async () => {
    renderList({ route: '/wifi?sheet=wifi-options&wifiIndex=1' });
    const sheet = await screen.findByRole('dialog', { name: 'MyHome_5G' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Đóng' }));
    await vi.waitFor(() => expect(location()).toBe('/wifi'));
  });

  it('turns a network off after confirmation, shows it optimistically and confirms by polling', async () => {
    installFakeClock();
    const update = vi.spyOn(wifiNetworkApi, 'update');
    renderList();
    await advanceFakeTime(0);
    const sheet = openOptions('MyHome_WF6');
    const toggle = within(sheet).getByRole('switch', { name: 'Bật / Tắt MyHome_WF6' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);
    const confirm = screen.getByRole('alertdialog', { name: 'Tắt Wi-Fi MyHome_WF6?' });
    expect(confirm).toHaveTextContent('kể cả điện thoại này');
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Tắt Wi-Fi' }));
    await advanceFakeTime(0);

    expect(update).toHaveBeenCalledWith(SERIAL, 0, { enabled: false }, expect.any(String));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(within(sheet).getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(within(sheet).getByRole('switch')).toHaveAttribute('aria-busy', 'true');
    expect(within(card('MyHome_WF6')).getByText('Đang áp dụng…')).toBeInTheDocument();

    await advanceFakeTime(2_500);
    expect(screen.getByText('Đã tắt Wi-Fi MyHome_WF6')).toBeInTheDocument();
    expect(within(card('MyHome_WF6')).getByText('Đang tắt')).toBeInTheDocument();
    expect(within(sheet).getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(within(sheet).getByRole('switch')).not.toHaveAttribute('aria-busy');
  });

  it('turns a network on without confirmation', async () => {
    installFakeClock();
    renderList();
    await advanceFakeTime(0);
    const sheet = openOptions('MyHome_IoT');
    fireEvent.click(within(sheet).getByRole('switch'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await advanceFakeTime(2_500);
    expect(screen.getByText('Đã bật Wi-Fi MyHome_IoT')).toBeInTheDocument();
    expect(within(card('MyHome_IoT')).getByText('Đang bật')).toBeInTheDocument();
  });

  it('keeps the switch when the confirmation is cancelled', async () => {
    renderList();
    await listReady();
    const sheet = openOptions('MyHome_WF6');
    fireEvent.click(within(sheet).getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(within(sheet).getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('treats UNKNOWN as "sent, awaiting the modem" and keeps the optimistic value', async () => {
    installFakeClock();
    setWifiNetworkMockOptions({ commandOutcome: 'UNKNOWN' });
    renderList();
    await advanceFakeTime(0);
    const sheet = openOptions('MyHome_WF6');
    fireEvent.click(within(sheet).getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Tắt Wi-Fi' }));
    await advanceFakeTime(2_500);

    expect(screen.getAllByText('Đã gửi yêu cầu, đang chờ modem xác nhận').length).toBeGreaterThan(0);
    expect(
      within(card('MyHome_WF6')).getByText('Đã gửi yêu cầu, đang chờ modem xác nhận'),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // A second write while the first is still UNKNOWN would stop tracking it: the switch is locked.
    const update = vi.spyOn(wifiNetworkApi, 'update');
    expect(within(sheet).getByRole('switch')).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(within(sheet).getByRole('switch'));
    await advanceFakeTime(100);
    expect(update).not.toHaveBeenCalled();
  });

  it('rolls back and explains the error when the command FAILS', async () => {
    installFakeClock();
    setWifiNetworkMockOptions({ commandOutcome: 'FAILED', commandErrorCode: 'VERIFY_MISMATCH' });
    renderList();
    await advanceFakeTime(0);
    const sheet = openOptions('MyHome_WF6');
    fireEvent.click(within(sheet).getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Tắt Wi-Fi' }));
    await advanceFakeTime(0);
    expect(within(sheet).getByRole('switch')).toHaveAttribute('aria-checked', 'false');

    await advanceFakeTime(2_500);
    expect(
      screen.getByText(
        'Chưa áp dụng được thay đổi cho MyHome_WF6. Modem chưa áp dụng thay đổi. Vui lòng thử lại.',
      ),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(within(card('MyHome_WF6')).getByText('Đang bật')).toBeInTheDocument();
  });

  it('toasts the API error when the PATCH is rejected (409 DEVICE_OFFLINE)', async () => {
    renderList();
    await listReady();
    const sheet = openOptions('MyHome_WF6');
    setMockScenario({ device: 'offline' });
    fireEvent.click(within(sheet).getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Tắt Wi-Fi' }));
    expect(await screen.findByText('Modem đang mất kết nối.')).toBeInTheDocument();
    expect(within(sheet).getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('copies the password through the bridge when supported', async () => {
    const client = createFakeSuperAppClient();
    const reveal = vi.spyOn(wifiNetworkApi, 'revealPassword');
    const { queryClient } = renderList({ superAppClient: client });
    await listReady();
    const sheet = openOptions('MyHome_WF6');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Sao chép mật khẩu Wi-Fi' }));

    expect(await screen.findByText('Đã sao chép mật khẩu')).toBeInTheDocument();
    expect(reveal).toHaveBeenCalledWith(SERIAL, 0, 'COPY');
    expect(client.copyText).toHaveBeenCalledWith('MyHome@2024');
    expect(screen.queryByText('MyHome@2024')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('falls back to the Clipboard API when copyText is unsupported', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const client = createFakeSuperAppClient(
      undefined,
      bridgeMethods.filter((method) => method !== 'copyText'),
    );
    renderList({ superAppClient: client });
    await listReady();
    const sheet = openOptions('MyHome_5G');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Sao chép mật khẩu Wi-Fi' }));

    expect(await screen.findByText('Đã sao chép mật khẩu')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith('MyHome5G@2024');
    expect(client.copyText).not.toHaveBeenCalled();
    await act(async () => {
      Reflect.deleteProperty(navigator, 'clipboard');
    });
  });

  it('reports a copy failure', async () => {
    const client = createFakeSuperAppClient();
    client.copyText.mockRejectedValueOnce(new Error('blocked'));
    renderList({ superAppClient: client });
    await listReady();
    const sheet = openOptions('MyHome_WF6');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Sao chép mật khẩu Wi-Fi' }));
    expect(await screen.findByText('Không sao chép được mật khẩu. Vui lòng thử lại.')).toBeInTheDocument();
  });
});
