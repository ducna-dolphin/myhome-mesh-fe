import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { wifiNetworkApi, type WifiNetwork } from '@/entities/wifi-network';
import { setWifiNetworkMockOptions } from '@/entities/wifi-network/mock';
import { MOCK_CONTRACTS } from '@/shared/api/mock';
import { bridgeMethods, type BridgeMethod } from '@/shared/super-app';
import { createFakeSuperAppClient, renderWithProviders } from '@/shared/test';
import { WifiQrShare } from './wifi-qr-share';

const toDataURL = vi.hoisted(() =>
  vi.fn(async (text: string) => `data:image/png;base64,${encodeURIComponent(text)}`),
);
vi.mock('qrcode', () => ({ toDataURL, default: { toDataURL } }));

const SERIAL = MOCK_CONTRACTS[0].serialNumber;
const network = (patch: Partial<WifiNetwork> = {}): WifiNetwork => ({
  wifiIndex: 0,
  ssid: 'MyHome_WF6',
  band: 'BAND_2_4GHZ',
  enabled: true,
  securityMode: 'WPA2-PSK',
  ...patch,
});

function renderShare(wifi: WifiNetwork = network(), supported: Iterable<BridgeMethod> = bridgeMethods) {
  const client = createFakeSuperAppClient(undefined, supported);
  const view = renderWithProviders(<WifiQrShare serialNumber={SERIAL} network={wifi} />, {
    superAppClient: client,
  });
  return { ...view, client };
}

afterEach(() => {
  vi.restoreAllMocks();
  toDataURL.mockClear();
});

describe('WifiQrShare', () => {
  it('reveals with purpose QR and renders the escaped WIFI: payload as an image', async () => {
    const reveal = vi.spyOn(wifiNetworkApi, 'revealPassword');
    renderShare();

    const image = await screen.findByRole('img', { name: 'Mã QR kết nối Wi-Fi MyHome_WF6' });
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal).toHaveBeenCalledWith(SERIAL, 0, 'QR');
    expect(toDataURL).toHaveBeenCalledWith('WIFI:T:WPA;S:MyHome_WF6;P:MyHome@2024;;', expect.any(Object));
    expect(image.getAttribute('src')).toContain('data:image/png');
    expect(screen.getByText('2.4GHz')).toBeInTheDocument();
    expect(
      screen.getByText('Mã QR chứa mật khẩu Wi-Fi. Chỉ chia sẻ cho người bạn tin tưởng.'),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('MyHome@2024');
  });

  it('escapes \\ ; , : " in the password', async () => {
    // Fixture password of wifiIndex 2 is `IoT;Home:2024`.
    renderShare(network({ wifiIndex: 2, ssid: 'MyHome_IoT', enabled: false }));
    await screen.findByRole('img', { name: /MyHome_IoT/ });
    expect(toDataURL).toHaveBeenCalledWith(
      'WIFI:T:WPA;S:MyHome_IoT;P:IoT\\;Home\\:2024;;',
      expect.any(Object),
    );
    // Disabled network: QR is still shown (M-08 pending) with a notice.
    expect(screen.getByText(/Wi-Fi này đang tắt/)).toBeInTheDocument();
  });

  it('saves and shares through the bridge when supported', async () => {
    const { client } = renderShare();
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu ảnh QR' }));
    expect(await screen.findByText('Đã lưu ảnh QR')).toBeInTheDocument();
    expect(client.saveImage).toHaveBeenCalledWith(expect.stringContaining('data:image/png'));

    fireEvent.click(screen.getByRole('button', { name: 'Chia sẻ' }));
    expect(client.shareImage).toHaveBeenCalledWith(
      expect.stringContaining('data:image/png'),
      'Kết nối Wi-Fi MyHome_WF6',
    );
  });

  it('hides "Chia sẻ" and falls back to a download link without bridge support', async () => {
    const { client } = renderShare(
      network(),
      bridgeMethods.filter((method) => method !== 'saveImage' && method !== 'shareImage'),
    );
    const link = await screen.findByRole('link', { name: 'Lưu ảnh QR' });
    expect(link).toHaveAttribute('download', 'wifi-MyHome_WF6.png');
    expect(link.getAttribute('href')).toContain('data:image/png');
    expect(screen.queryByRole('button', { name: 'Chia sẻ' })).not.toBeInTheDocument();
    expect(client.saveImage).not.toHaveBeenCalled();
  });

  it('shows the reveal error with retry (429)', async () => {
    setWifiNetworkMockOptions({ revealRateLimited: true });
    renderShare();
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn thao tác quá nhiều lần');
    expect(screen.queryByRole('button', { name: 'Lưu ảnh QR' })).not.toBeInTheDocument();

    setWifiNetworkMockOptions({ revealRateLimited: false });
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('img', { name: /MyHome_WF6/ })).toBeInTheDocument();
  });

  it('drops the QR (and password) on unmount', async () => {
    const { unmount, queryClient } = renderShare();
    await screen.findByRole('img', { name: /MyHome_WF6/ });
    unmount();
    expect(document.querySelector('img')).toBeNull();
    await vi.waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });
});
