import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectedDeviceApi, type ConnectedDevice } from '@/entities/connected-device';
import { MOCK_CONTRACTS, setMockScenario } from '@/shared/api/mock';
import { renderWithProviders } from '@/shared/test';
import { ConnectedDeviceList } from './connected-device-list';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderList(route = '/devices') {
  return renderWithProviders(
    <>
      <ConnectedDeviceList serialNumber={SERIAL} />
      <LocationProbe />
    </>,
    { route },
  );
}

const rowTitles = () =>
  within(screen.getByRole('list'))
    .getAllByRole('link')
    .map((link) => link.querySelector('.ui-list-row__title')?.textContent);

const chip = (name: RegExp) => screen.getByRole('button', { name });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConnectedDeviceList', () => {
  it('shows counts on the filter chips and sorts connected → inactive → blocked', async () => {
    renderList();
    expect(screen.getByRole('status', { name: 'Đang tải danh sách thiết bị' })).toBeInTheDocument();
    await screen.findByRole('list');

    expect(chip(/^Tất cả/)).toHaveTextContent('Tất cả10');
    expect(chip(/^Đang kết nối/)).toHaveTextContent('Đang kết nối5');
    expect(chip(/^Đang bị chặn/)).toHaveTextContent('Đang bị chặn1');
    expect(chip(/^Tất cả/)).toHaveAttribute('aria-pressed', 'true');

    expect(rowTitles()).toEqual([
      'iPhone của Minh',
      'MacBook Air',
      'Mesh tầng 2',
      'Samsung Smart TV',
      'Synology NAS',
      'android-5f2c1e',
      'Galaxy A54',
      'iPad của Lan',
      'Laptop công ty',
      'Camera cổng',
    ]);

    const blockedRow = screen.getByRole('link', { name: /Camera cổng/ }).closest('.ui-list-row')!;
    expect(blockedRow).toHaveClass('ui-list-row--danger');
    expect(within(blockedRow as HTMLElement).getByText('Đã chặn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Galaxy A54/ })).toHaveTextContent('Không hoạt động');
    expect(screen.getByRole('link', { name: /MacBook Air/ })).toHaveAttribute(
      'href',
      '/devices/F0%3A18%3A98%3A44%3A55%3A66',
    );
  });

  it('filters from ?filter= and writes the chip choice back to the URL', async () => {
    renderList('/devices?filter=blocked');
    await screen.findByRole('list');
    expect(chip(/^Đang bị chặn/)).toHaveAttribute('aria-pressed', 'true');
    expect(rowTitles()).toEqual(['Camera cổng']);

    fireEvent.click(chip(/^Đang kết nối/));
    expect(screen.getByTestId('location')).toHaveTextContent('/devices?filter=connected');
    expect(rowTitles()).toHaveLength(5);

    fireEvent.click(chip(/^Tất cả/));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/devices$/);
    expect(rowTitles()).toHaveLength(10);
  });

  it('shows an empty state per filter', async () => {
    vi.spyOn(connectedDeviceApi, 'list').mockResolvedValue({
      data: [
        { macAddress: 'AA:AA:AA:AA:AA:01', name: 'TV', kind: 'CLIENT', status: 'CONNECTED', blockable: true },
      ],
      meta: null,
      errors: [],
    });
    renderList('/devices?filter=blocked');
    expect(await screen.findByText('Không có thiết bị nào đang bị chặn.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('sorts by traffic share and highlights the focused device (Quality tab HOGGED)', async () => {
    renderList('/devices?sort=traffic&focus=58-2f-40-11-22-33');
    await screen.findByRole('list');
    expect(rowTitles().slice(0, 4)).toEqual([
      'Samsung Smart TV',
      'MacBook Air',
      'iPhone của Minh',
      'Synology NAS',
    ]);
    const tv = screen.getByRole('link', { name: /Samsung Smart TV/ }).closest('.ui-list-row')!;
    expect(tv).toHaveAttribute('data-focused', 'true');
    expect(tv).toHaveTextContent('72% lưu lượng');
    expect(screen.getByRole('link', { name: /MacBook Air/ }).closest('.ui-list-row')).not.toHaveAttribute(
      'data-focused',
    );
  });

  it('shows "Thiết bị không tên" for a device without a name', async () => {
    const unnamed: ConnectedDevice = {
      macAddress: 'B8:27:EB:BB:CC:04',
      name: null,
      kind: 'CLIENT',
      status: 'CONNECTED',
      connectionType: 'WIRELESS',
      blockable: true,
    };
    vi.spyOn(connectedDeviceApi, 'list').mockResolvedValue({ data: [unnamed], meta: null, errors: [] });
    renderList();
    expect(await screen.findByRole('link', { name: /Thiết bị không tên/ })).toHaveTextContent(
      'B8:27:EB:BB:CC:04',
    );
  });

  it('lists partial errors and the stale label without hiding the devices', async () => {
    vi.spyOn(connectedDeviceApi, 'list').mockResolvedValue({
      data: [
        {
          macAddress: 'AA:AA:AA:AA:AA:01',
          name: 'TV',
          kind: 'CLIENT',
          status: 'CONNECTED',
          blockable: false,
        },
      ],
      meta: { source: 'CACHE', stale: true, updatedAt: '2026-10-08T03:15:00Z' },
      errors: [
        { code: 'UPSTREAM_UNAVAILABLE', target: 'blockList' },
        { code: 'UPSTREAM_TIMEOUT', target: 'topology' },
      ],
    });
    renderList();
    await screen.findByRole('list');
    const alerts = screen.getAllByRole('alert').map((alert) => alert.textContent);
    expect(alerts).toEqual([
      'Chưa đọc được danh sách chặn, trạng thái chặn có thể chưa chính xác.',
      'Chưa đọc được cấu trúc Mesh nên tạm thời chưa thể chặn thiết bị.',
    ]);
    expect(screen.getByText(/^Cập nhật lúc/)).toBeInTheDocument();
  });

  it('shows the offline message with retry when the modem is unreachable', async () => {
    setMockScenario({ device: 'offline' });
    renderList();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Modem đang mất kết nối.');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    setMockScenario({ device: 'online' });
    fireEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByRole('list')).toBeInTheDocument());
  });

  it('polls the list every 30s', async () => {
    const list = vi.spyOn(connectedDeviceApi, 'list');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderList();
      await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(30_100);
      await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    } finally {
      vi.useRealTimers();
    }
  });
});
