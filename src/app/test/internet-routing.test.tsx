import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LAST_TAB_STORAGE_KEY } from '@/shared/lib';
import { renderApp } from './render-app';

afterEach(() => {
  window.localStorage.clear();
});

async function findTab(name: string) {
  return screen.findByRole('tab', { name });
}

describe('Internet routing', () => {
  it('redirects / to the Wifi tab by default', async () => {
    const { router } = renderApp();
    expect(await findTab('Wifi')).toHaveAttribute('aria-selected', 'true');
    expect(router.state.location.pathname).toBe('/wifi');
    expect(screen.getByRole('heading', { level: 1, name: 'Internet' })).toBeInTheDocument();
  });

  it('redirects / to the last visited tab and remembers tab changes', async () => {
    window.localStorage.setItem(LAST_TAB_STORAGE_KEY, '/modem');
    const { router } = renderApp();
    expect(await findTab('Modem')).toHaveAttribute('aria-selected', 'true');
    expect(router.state.location.pathname).toBe('/modem');

    fireEvent.click(screen.getByRole('tab', { name: 'Chất lượng' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/quality'));
    // The router state flips before the lazy tab commits and the layout effect stores it.
    await waitFor(() => expect(window.localStorage.getItem(LAST_TAB_STORAGE_KEY)).toBe('/quality'));
  });

  it.each([
    ['/clients', '/devices'],
    ['/clients/client-phone', '/devices'],
    ['/health', '/wifi'],
    ['/diagnostics', '/quality'],
    ['/mesh', '/modem'],
    ['/unknown/route', '/wifi'],
  ])('redirects legacy %s to %s', async (from, to) => {
    const { router } = renderApp({ entries: [from] });
    await waitFor(() => expect(router.state.location.pathname).toBe(to));
    expect(await screen.findByRole('tabpanel')).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    const { router } = renderApp({ entries: ['/wifi'] });
    const wifi = await findTab('Wifi');
    act(() => wifi.focus());
    fireEvent.keyDown(wifi, { key: 'ArrowRight' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/devices'));
    expect(screen.getByRole('tab', { name: 'Thiết bị kết nối' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Thiết bị kết nối' }), { key: 'End' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/quality'));
  });

  it('closes the miniapp with the header X button', async () => {
    const { superAppClient } = renderApp({ entries: ['/wifi'] });
    await findTab('Wifi');
    const header = screen.getByRole('banner');
    fireEvent.click(within(header).getByRole('button', { name: 'Đóng' }));
    expect(superAppClient.closeMiniApp).toHaveBeenCalledOnce();
  });

  it('renders a sub-page with its title and goes back in history', async () => {
    const { router } = renderApp({ entries: ['/devices', '/devices/AA%3ABB/edit'] });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Đổi tên / biểu tượng' }),
    ).toBeInTheDocument();
    // Unknown MAC: the edit page renders its "not found" state (Phase 7).
    expect(
      await screen.findByText('Không tìm thấy thiết bị. Thiết bị có thể đã bị xoá khỏi danh sách.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/devices'));
    expect(await findTab('Thiết bị kết nối')).toHaveAttribute('aria-selected', 'true');
  });

  it('goes to the owning tab when a deep-linked sub-page has no history', async () => {
    const { router } = renderApp({ entries: ['/wifi/1/share'] });
    expect(await screen.findByRole('heading', { level: 1, name: 'Chia sẻ Wi-Fi' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/wifi'));
  });
});
