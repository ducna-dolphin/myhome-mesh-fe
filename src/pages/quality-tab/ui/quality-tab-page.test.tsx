import { fireEvent, screen, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { healthCheckApi, type HealthCheck, type HealthCheckItem } from '@/entities/health-check';
import { ontDeviceApi } from '@/entities/ont-device';
import { wifiNetworkApi } from '@/entities/wifi-network';
import { ApiError } from '@/shared/api';
import { createMockCommand, MOCK_CONTRACTS, setMockScenario } from '@/shared/api/mock';
import { MESH_ORDER_DEEPLINK } from '@/shared/config/quality-deeplinks';
import { advanceFakeTime, installFakeClock, renderWithProviders } from '@/shared/test';
import { QualityTabPage } from './quality-tab-page';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderPage() {
  return renderWithProviders(
    <>
      <QualityTabPage />
      <LocationProbe />
    </>,
    { route: '/quality' },
  );
}

const done = (items: HealthCheckItem[], patch: Partial<HealthCheck> = {}): HealthCheck => ({
  checkId: 'fresh-check',
  state: 'DONE',
  overallStatus: 'NO_ISSUE',
  issueCount: 0,
  items,
  createdAt: '2026-10-08T02:00:00Z',
  finishedAt: '2026-10-08T02:00:06Z',
  ...patch,
});

const stableItems: HealthCheckItem[] = [
  { itemType: 'INTERNET_LINE', state: 'DONE', status: 'STABLE', dropCount: 0 },
  { itemType: 'WIFI_SIGNAL', state: 'DONE', status: 'PASS' },
  {
    itemType: 'CONNECTED_DEVICES',
    state: 'DONE',
    status: 'NORMAL',
    action: 'OPEN_DEVICES_TAB',
    activeDeviceCount: 7,
  },
];

const text = () => document.body.textContent ?? '';
const header = () => screen.getByRole('region', { name: 'Chất lượng đường truyền' });

/** Contract list + detail + POST + first render. */
const settle = () => advanceFakeTime(300);

beforeEach(() => {
  installFakeClock();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('QualityTabPage — run flow', () => {
  it('202: shows the running stepper, polls every 3s and finishes with the results', async () => {
    const create = vi.spyOn(healthCheckApi, 'create');
    const get = vi.spyOn(healthCheckApi, 'get');
    renderPage();
    await settle();

    expect(create).toHaveBeenCalledTimes(1);
    expect(within(header()).getByText('Đang kiểm tra...')).toBeInTheDocument();
    expect(within(header()).getByText('Vui lòng đợi trong giây lát')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '17');
    expect(screen.getByLabelText('Đường truyền: Đang kiểm tra')).toBeInTheDocument();
    expect(text()).toContain('Chờ bước trước xong');
    expect(get).not.toHaveBeenCalled();

    await advanceFakeTime(3_000);
    expect(get).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Đường truyền: Đã xong')).toBeInTheDocument();
    expect(screen.getByLabelText('Sóng Wi-fi: Đang kiểm tra')).toBeInTheDocument();
    expect(text()).toContain('Ổn định, hôm nay không lần nào rớt mạng');

    await advanceFakeTime(3_000);
    expect(get).toHaveBeenCalledTimes(2);
    expect(within(header()).getByText('Hoàn tất kiểm tra')).toBeInTheDocument();
    expect(within(header()).getByText('Không phát hiện lỗi')).toBeInTheDocument();
    expect(
      within(header()).getByText(/^Đo lần gần nhất \d{2}:\d{2} - \d{2}\/\d{2}\/\d{4}$/),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(text()).toContain('5 thiết bị đang dùng mạng');

    await advanceFakeTime(9_000);
    expect(get).toHaveBeenCalledTimes(2); // stopped once DONE
  });

  it('200: shows the fresh result without polling', async () => {
    vi.spyOn(healthCheckApi, 'create').mockResolvedValue({
      status: 200,
      check: done(stableItems),
      location: null,
    });
    const get = vi.spyOn(healthCheckApi, 'get');
    renderPage();
    await settle();
    expect(within(header()).getByText('Hoàn tất kiểm tra')).toBeInTheDocument();
    expect(text()).toContain('7 thiết bị đang dùng mạng');
    await advanceFakeTime(10_000);
    expect(get).not.toHaveBeenCalled();
  });

  it('shows the latest stored result while the POST is pending', async () => {
    vi.spyOn(healthCheckApi, 'create').mockReturnValue(new Promise(() => {}));
    vi.spyOn(healthCheckApi, 'latest').mockResolvedValue(done(stableItems));
    renderPage();
    await settle();
    expect(text()).toContain('7 thiết bị đang dùng mạng');
    expect(within(header()).getByText('Đang kiểm tra...')).toBeInTheDocument();
  });

  it('"Kiểm tra lại" sends a new POST with a new idempotency key', async () => {
    const create = vi.spyOn(healthCheckApi, 'create').mockResolvedValue({
      status: 200,
      check: done(stableItems),
      location: null,
    });
    renderPage();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại' }));
    await settle();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]?.[1]).not.toBe(create.mock.calls[0]?.[1]);
  });

  it('treats a run still going after 3 minutes as failed', async () => {
    vi.spyOn(healthCheckApi, 'get').mockImplementation(async (_serial, checkId) => ({
      checkId,
      state: 'RUNNING',
      items: [
        { itemType: 'INTERNET_LINE', state: 'DONE', status: 'STABLE', dropCount: 0 },
        { itemType: 'WIFI_SIGNAL', state: 'RUNNING' },
        { itemType: 'CONNECTED_DEVICES', state: 'PENDING' },
      ],
    }));
    renderPage();
    await settle();
    await advanceFakeTime(179_000, 1_000);
    expect(within(header()).getByText('Đang kiểm tra...')).toBeInTheDocument();
    await advanceFakeTime(1_500, 500);
    expect(within(header()).getByText('Hoàn tất kiểm tra')).toBeInTheDocument();
    expect(within(header()).getByText('Chưa kiểm tra được đầy đủ')).toBeInTheDocument();
    expect(within(header()).getByText(/Kiểm tra mất nhiều thời gian hơn dự kiến/)).toBeInTheDocument();
    expect(screen.getAllByText('Chưa kiểm tra được phần này')).toHaveLength(2);
    expect(text()).toContain('Ổn định');
  });

  it('stops polling when the tab is left', async () => {
    const get = vi.spyOn(healthCheckApi, 'get');
    const { unmount } = renderPage();
    await settle();
    await advanceFakeTime(3_000);
    expect(get).toHaveBeenCalledTimes(1);
    unmount();
    await advanceFakeTime(15_000);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('shows the start error with a retry when the POST fails', async () => {
    vi.spyOn(healthCheckApi, 'latest').mockResolvedValue(null);
    const create = vi
      .spyOn(healthCheckApi, 'create')
      .mockRejectedValueOnce(
        new ApiError('validation', 409, 'busy', undefined, { code: 'DEVICE_BUSY', retryAfterSec: 5 }),
      );
    renderPage();
    await settle();
    expect(within(header()).getByText('Chưa bắt đầu kiểm tra được.')).toBeInTheDocument();
    expect(within(header()).getByRole('alert')).toHaveTextContent('Modem đang thực hiện thao tác khác');
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại' }));
    await settle();
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe('QualityTabPage — actions', () => {
  // Status → action button (LLD P6-01 table, BR-68/BR-69).
  const actionCases: [string, HealthCheckItem[], string | null][] = [
    [
      'UNSTABLE → Reset Modem ngay',
      [{ itemType: 'INTERNET_LINE', state: 'DONE', status: 'UNSTABLE', action: 'RESET_MODEM', dropCount: 2 }],
      'Reset Modem ngay',
    ],
    [
      'DISCONNECTED → Báo hỏng (no reset)',
      [{ itemType: 'INTERNET_LINE', state: 'DONE', status: 'DISCONNECTED', action: 'REPORT_FAULT' }],
      'Báo hỏng',
    ],
    [
      'FAIL → Đặt lắp thêm Mesh',
      [{ itemType: 'WIFI_SIGNAL', state: 'DONE', status: 'FAIL', action: 'ORDER_MESH' }],
      'Đặt lắp thêm Mesh',
    ],
    [
      'OFF → Bật Wi-Fi',
      [{ itemType: 'WIFI_SIGNAL', state: 'DONE', status: 'OFF', action: 'ENABLE_WIFI' }],
      'Bật Wi-Fi',
    ],
    [
      'STABLE → no action',
      [{ itemType: 'INTERNET_LINE', state: 'DONE', status: 'STABLE', action: null }],
      null,
    ],
    ['PASS → no action', [{ itemType: 'WIFI_SIGNAL', state: 'DONE', status: 'PASS', action: null }], null],
  ];
  const actionLabels = ['Reset Modem ngay', 'Báo hỏng', 'Đặt lắp thêm Mesh', 'Bật Wi-Fi'];

  it.each(actionCases)('%s', async (_name, items, expected) => {
    vi.spyOn(healthCheckApi, 'create').mockResolvedValue({ status: 200, check: done(items), location: null });
    renderPage();
    await settle();
    for (const label of actionLabels) {
      const button = screen.queryByRole('button', { name: label });
      if (label === expected) expect(button).toBeInTheDocument();
      else expect(button).not.toBeInTheDocument();
    }
  });

  it('opens the Devices tab from the devices card', async () => {
    vi.spyOn(healthCheckApi, 'create').mockResolvedValue({
      status: 200,
      check: done(stableItems),
      location: null,
    });
    renderPage();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /7 thiết bị đang dùng mạng/ }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/devices$/);
  });

  it('HOGGED opens the Devices tab sorted by traffic and focused on the top device', async () => {
    setMockScenario({ health: 'unstable' });
    renderPage();
    await settle();
    await advanceFakeTime(6_000);
    fireEvent.click(screen.getByRole('button', { name: /Samsung Smart TV đang chiếm 72% đường truyền/ }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/devices?sort=traffic&focus=58%3A2F%3A40%3A11%3A22%3A33',
    );
  });

  it('Reset Modem: confirm → reboot → "Đang khởi động lại…" → re-check after CONFIRMED', async () => {
    setMockScenario({ health: 'unstable' });
    const create = vi.spyOn(healthCheckApi, 'create');
    renderPage();
    await settle();
    await advanceFakeTime(6_000);
    expect(text()).toContain('Chập chờn, hôm nay rớt mạng 3 lần');

    fireEvent.click(screen.getByRole('button', { name: 'Reset Modem ngay' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('gián đoạn khoảng 2 phút');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Khởi động lại' }));
    await settle();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Đang khởi động lại…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kiểm tra lại' })).toBeDisabled();
    expect(create).toHaveBeenCalledTimes(1);

    await advanceFakeTime(9_500, 250);
    expect(screen.queryByText('Đang khởi động lại…')).not.toBeInTheDocument();
    expect(text()).toContain('Modem đã khởi động lại xong.');
    expect(create).toHaveBeenCalledTimes(2);
    const second = await create.mock.results[1]?.value;
    expect(second).toMatchObject({ status: 202 }); // backend invalidated the last check
    expect(within(header()).getByText('Đang kiểm tra...')).toBeInTheDocument();
  });

  it('Reset Modem: 429 RATE_LIMITED shows the wait time', async () => {
    setMockScenario({ health: 'unstable' });
    for (let i = 0; i < 3; i += 1)
      createMockCommand({ type: 'REBOOT', serialNumber: SERIAL, immediate: true });
    vi.spyOn(healthCheckApi, 'create').mockResolvedValue({
      status: 200,
      check: done([{ itemType: 'INTERNET_LINE', state: 'DONE', status: 'UNSTABLE', action: 'RESET_MODEM' }]),
      location: null,
    });
    const reboot = vi.spyOn(ontDeviceApi, 'reboot');
    renderPage();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Modem ngay' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Khởi động lại' }));
    await settle();
    expect(reboot).toHaveBeenCalledTimes(1);
    expect(text()).toContain(
      'Modem chỉ được khởi động lại tối đa 3 lần trong 30 phút. Vui lòng thử lại sau 10 phút.',
    );
    expect(screen.queryByText('Đang khởi động lại…')).not.toBeInTheDocument();
  });

  it('Báo hỏng creates a fault report and shows the ticket code', async () => {
    setMockScenario({ health: 'down' });
    const report = vi.spyOn(healthCheckApi, 'createFaultReport');
    renderPage();
    await settle();
    await advanceFakeTime(6_000);
    expect(text()).toContain('Mất kết nốiVui lòng kiểm tra lại nguồn Modem');
    expect(screen.queryByRole('button', { name: 'Reset Modem ngay' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Báo hỏng' }));
    await settle();
    expect(report).toHaveBeenCalledWith(MOCK_CONTRACTS[0].contractId, expect.any(String), expect.any(String));
    expect(screen.getByRole('status')).toHaveTextContent(/Đã ghi nhận báo hỏng\. Mã phiếu: BH-\d+/);
  });

  it('Báo hỏng: 503 shows an error toast', async () => {
    vi.spyOn(healthCheckApi, 'create').mockResolvedValue({
      status: 200,
      check: done([
        { itemType: 'INTERNET_LINE', state: 'DONE', status: 'DISCONNECTED', action: 'REPORT_FAULT' },
      ]),
      location: null,
    });
    vi.spyOn(healthCheckApi, 'createFaultReport').mockRejectedValue(
      new ApiError('server', 503, 'down', undefined, { code: 'UPSTREAM_UNAVAILABLE' }),
    );
    renderPage();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Báo hỏng' }));
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('Chưa gửi được báo hỏng. Vui lòng thử lại sau.');
  });

  it('Bật Wi-Fi enables the networks then re-runs the check', async () => {
    setMockScenario({ health: 'off' });
    vi.spyOn(wifiNetworkApi, 'list').mockResolvedValue({
      data: [{ wifiIndex: 0, ssid: 'Home', band: 'BAND_2_4GHZ', enabled: false }],
      meta: null,
      errors: [],
    });
    const update = vi
      .spyOn(wifiNetworkApi, 'update')
      .mockResolvedValue({ commandId: 'w', type: 'WIFI_UPDATE', state: 'CONFIRMED' });
    const create = vi.spyOn(healthCheckApi, 'create');
    renderPage();
    await settle();
    await advanceFakeTime(6_000);
    expect(text()).toContain('Không có, Wi-Fi đang tắt');
    fireEvent.click(screen.getByRole('button', { name: 'Bật Wi-Fi' }));
    await settle();
    expect(update).toHaveBeenCalledWith(
      SERIAL,
      0,
      { enabled: true },
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('Đặt lắp thêm Mesh opens the super-app deeplink', async () => {
    vi.spyOn(healthCheckApi, 'create').mockResolvedValue({
      status: 200,
      check: done([{ itemType: 'WIFI_SIGNAL', state: 'DONE', status: 'FAIL', action: 'ORDER_MESH' }]),
      location: null,
    });
    const { superAppClient } = renderPage();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lắp thêm Mesh' }));
    await settle();
    expect(superAppClient.openDeeplink).toHaveBeenCalledWith(MESH_ORDER_DEEPLINK);
  });
});
