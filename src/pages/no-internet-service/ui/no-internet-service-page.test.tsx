import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VNPT_SHOP_INTERNET_DEEPLINK } from '@/shared/config/deeplinks';
import { bridgeMethods, BridgeError } from '@/shared/super-app';
import { createFakeSuperAppClient, renderWithProviders } from '@/shared/test';
import { NoInternetServicePage } from './no-internet-service-page';

describe('NoInternetServicePage', () => {
  it('renders the first slide and 5 dot buttons', () => {
    renderWithProviders(<NoInternetServicePage />);
    expect(
      screen.getAllByRole('heading', { name: 'Quản lý mạng gia đình trong tầm tay' })[0],
    ).toBeInTheDocument();
    const dots = screen.getAllByRole('button', { name: /Chuyển tới trang/ });
    expect(dots).toHaveLength(5);
    expect(dots[0]).toHaveAttribute('aria-current', 'true');

    fireEvent.click(dots[2]!);
    expect(dots[2]).toHaveAttribute('aria-current', 'true');
    expect(dots[0]).not.toHaveAttribute('aria-current');
  });

  it('opens the VNPT Shop deeplink', () => {
    const { superAppClient } = renderWithProviders(<NoInternetServicePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký ngay' }));
    expect(superAppClient.openDeeplink).toHaveBeenCalledWith(VNPT_SHOP_INTERNET_DEEPLINK);
  });

  it('shows a toast when the bridge call fails', async () => {
    const client = createFakeSuperAppClient();
    client.openDeeplink.mockRejectedValueOnce(new BridgeError('FAILED', 'openDeeplink'));
    renderWithProviders(<NoInternetServicePage />, { superAppClient: client });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký ngay' }));
    expect(await screen.findByText('Không mở được VNPT Shop. Vui lòng thử lại.')).toBeInTheDocument();
  });

  it('explains when the host does not support deeplinks', async () => {
    const client = createFakeSuperAppClient(
      undefined,
      bridgeMethods.filter((method) => method !== 'openDeeplink'),
    );
    renderWithProviders(<NoInternetServicePage />, { superAppClient: client });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký ngay' }));
    expect(await screen.findByText('Phiên bản ứng dụng chưa hỗ trợ mở VNPT Shop.')).toBeInTheDocument();
    expect(client.openDeeplink).not.toHaveBeenCalled();
  });

  it('closes the miniapp with the X button', () => {
    const { superAppClient } = renderWithProviders(<NoInternetServicePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(superAppClient.closeMiniApp).toHaveBeenCalledOnce();
  });
});
