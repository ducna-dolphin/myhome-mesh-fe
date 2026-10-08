import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandApi, commandKeys } from '@/entities/command';
import { healthCheckKeys } from '@/entities/health-check';
import { ontDeviceApi, ontDeviceKeys } from '@/entities/ont-device';
import { setOntDeviceMockRead } from '@/entities/ont-device/mock';
import { createMockCommand, MOCK_CONTRACTS, setMockScenario } from '@/shared/api/mock';
import { advanceFakeTime, installFakeClock, renderWithProviders } from '@/shared/test';
import { formatTemperature, formatTrafficGb, splitUptimeSec } from '../lib/format-ont-values';
import { ModemTabPage } from './modem-tab-page';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;

const settle = () => advanceFakeTime(300);

function rowValue(label: string): string {
  const term = screen.getByText(label, { selector: 'dt, dt *' }).closest('.modem-info__row');
  return term?.querySelector('dd')?.textContent ?? '';
}

function renderPage() {
  return renderWithProviders(<ModemTabPage />, { route: '/modem' });
}

beforeEach(() => {
  installFakeClock();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ONT value formatting', () => {
  it('formats uptime, traffic and temperature', () => {
    expect(splitUptimeSec(3 * 86_400 + 9 * 3_600 + 33 * 60 + 59)).toEqual({
      days: 3,
      hours: '09',
      minutes: '33',
    });
    expect(formatTrafficGb(Math.round(485.62 * 1024 ** 3))).toBe('485,62');
    expect(formatTrafficGb(null)).toBeNull();
    expect(formatTemperature(39.5)).toBe('39,5');
    expect(formatTemperature(undefined)).toBeNull();
  });
});

describe('ModemTabPage', () => {
  it('shows the ONT title, badge and the 7 information rows', async () => {
    renderPage();
    await settle();
    expect(screen.getByRole('heading', { name: 'AX3000CV2' })).toBeInTheDocument();
    expect(screen.getByText('ONT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Khởi động lại' })).toBeInTheDocument();
    expect(rowValue('Tên modem')).toContain('AX3000CV2');
    expect(rowValue('Địa chỉ MAC')).toBe('A4:56:02:3C:11:9F');
    expect(rowValue('IP WAN')).toBe('100.70.17.14');
    expect(rowValue('Phiên bản Firmware')).toBe('0.10.2');
    expect(rowValue('Thời gian hoạt động liên tục')).toBe('3 ngày 09g33p');
    expect(rowValue('Tổng lưu lượng truy cập *')).toBe('485,62 GB');
    expect(rowValue('Nhiệt độ modem *')).toBe('42°C');
    expect(screen.queryByText(/Cập nhật lúc/)).not.toBeInTheDocument();
  });

  it('shows "—" for null values (G-06, G-07) and short uptime without days', async () => {
    vi.spyOn(ontDeviceApi, 'get').mockResolvedValue({
      data: {
        serialNumber: SERIAL,
        displayName: 'Modem nhà',
        macAddress: null,
        wanIpAddress: '1.2.3.4',
        firmwareVersion: null,
        uptimeSec: 2 * 3_600 + 5 * 60,
        totalTrafficBytes: null,
        temperatureCelsius: null,
      },
      meta: null,
      errors: [],
    });
    renderPage();
    await settle();
    expect(rowValue('Địa chỉ MAC')).toBe('—');
    expect(rowValue('Phiên bản Firmware')).toBe('—');
    expect(rowValue('Thời gian hoạt động liên tục')).toBe('02g05p');
    expect(rowValue('Tổng lưu lượng truy cập *')).toBe('—');
    expect(rowValue('Nhiệt độ modem *')).toBe('—');
  });

  it('blanks the rows of a failed partial source and shows a section error', async () => {
    setOntDeviceMockRead({
      errors: [
        { code: 'UPSTREAM_TIMEOUT', target: 'wan' },
        { code: 'UPSTREAM_TIMEOUT', target: 'optical' },
      ],
    });
    renderPage();
    await settle();
    expect(rowValue('IP WAN')).toBe('—');
    expect(rowValue('Nhiệt độ modem *')).toBe('—');
    expect(rowValue('Địa chỉ MAC')).toBe('A4:56:02:3C:11:9F');
    expect(screen.getByRole('alert')).toHaveTextContent('Một số thông tin chưa tải được.');
  });

  it('shows the stale notice when served from an old cache', async () => {
    setOntDeviceMockRead({ stale: true });
    renderPage();
    await settle();
    expect(screen.getByText(/^Cập nhật lúc \d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('shows "Modem đang mất kết nối" when the device is offline', async () => {
    setMockScenario({ device: 'offline' });
    renderPage();
    await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('Modem đang mất kết nối');
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  describe('rename', () => {
    it('validates 1–32 characters and saves the new name into the cache', async () => {
      const { queryClient } = renderPage();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'Đổi tên modem' }));
      const input = screen.getByRole('textbox', { name: 'Tên modem' });

      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
      expect(screen.getByText('Vui lòng nhập tên modem.')).toBeInTheDocument();

      fireEvent.change(input, { target: { value: 'x'.repeat(33) } });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
      expect(screen.getByText('Tên modem tối đa 32 ký tự.')).toBeInTheDocument();

      const rename = vi.spyOn(ontDeviceApi, 'rename');
      fireEvent.change(input, { target: { value: '  Modem phòng khách ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
      await settle();
      expect(rename).toHaveBeenCalledWith(SERIAL, { displayName: 'Modem phòng khách' }, expect.any(String));
      expect(screen.getByRole('heading', { name: 'Modem phòng khách' })).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(queryClient.getQueryData(ontDeviceKeys.detail(SERIAL))).toMatchObject({
        data: { displayName: 'Modem phòng khách' },
      });
    });

    it('cancels without saving', async () => {
      const rename = vi.spyOn(ontDeviceApi, 'rename');
      renderPage();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'Đổi tên modem' }));
      fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(rename).not.toHaveBeenCalled();
    });
  });

  describe('reboot', () => {
    it('asks for confirmation, shows the banner and invalidates device + last check on CONFIRMED', async () => {
      const { queryClient } = renderPage();
      await settle();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

      fireEvent.click(screen.getByRole('button', { name: 'Khởi động lại' }));
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveTextContent('Khởi động lại modem?');
      expect(dialog).toHaveTextContent('gián đoạn khoảng 2 phút');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

      const reboot = vi.spyOn(ontDeviceApi, 'reboot');
      fireEvent.click(screen.getByRole('button', { name: 'Khởi động lại' }));
      fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Khởi động lại' }));
      await settle();
      expect(reboot).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Đang khởi động lại…')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Khởi động lại' })).toBeDisabled();

      await advanceFakeTime(9_500, 250);
      expect(screen.queryByText('Đang khởi động lại…')).not.toBeInTheDocument();
      expect(document.body.textContent).toContain('Modem đã khởi động lại xong.');
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ontDeviceKeys.detail(SERIAL) });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: healthCheckKeys.latest(SERIAL) });
    });

    it('resumes polling an active REBOOT command when the tab opens', async () => {
      createMockCommand({ type: 'REBOOT', serialNumber: SERIAL });
      createMockCommand({ type: 'WIFI_UPDATE', serialNumber: SERIAL, settleAfterMs: 60_000 });
      renderPage();
      await settle();
      expect(screen.getByText('Đang khởi động lại…')).toBeInTheDocument();
      await advanceFakeTime(9_000, 250);
      expect(screen.queryByText('Đang khởi động lại…')).not.toBeInTheDocument();
    });

    it('keeps tracking a resumed REBOOT after the active list refetches without it', async () => {
      createMockCommand({ type: 'REBOOT', serialNumber: SERIAL });
      const { queryClient } = renderPage();
      await settle();
      expect(screen.getByText('Đang khởi động lại…')).toBeInTheDocument();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

      // Focus/reconnect refetch: the backend no longer lists the command as active.
      vi.spyOn(commandApi, 'listActive').mockResolvedValue([]);
      await queryClient.refetchQueries({ queryKey: commandKeys.active(SERIAL) });
      await settle();
      expect(screen.getByText('Đang khởi động lại…')).toBeInTheDocument();

      await advanceFakeTime(9_000, 250);
      expect(screen.queryByText('Đang khởi động lại…')).not.toBeInTheDocument();
      expect(document.body.textContent).toContain('Modem đã khởi động lại xong.');
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ontDeviceKeys.detail(SERIAL) });
    });

    it('ignores active commands of other types', async () => {
      createMockCommand({ type: 'WIFI_UPDATE', serialNumber: SERIAL, settleAfterMs: 60_000 });
      renderPage();
      await settle();
      expect(screen.queryByText('Đang khởi động lại…')).not.toBeInTheDocument();
    });

    it('shows the 3-per-30-minutes limit on 429 RATE_LIMITED', async () => {
      for (let i = 0; i < 3; i += 1)
        createMockCommand({ type: 'REBOOT', serialNumber: SERIAL, immediate: true });
      renderPage();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'Khởi động lại' }));
      fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Khởi động lại' }));
      await settle();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Modem chỉ được khởi động lại tối đa 3 lần trong 30 phút. Vui lòng thử lại sau 10 phút.',
      );
      expect(screen.queryByText('Đang khởi động lại…')).not.toBeInTheDocument();
    });
  });
});
