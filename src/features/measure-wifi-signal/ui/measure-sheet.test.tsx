import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { measurementLocationApi, type MeasurementLocation } from '@/entities/measurement-location';
import { resetMeasurementLocationMockDb } from '@/entities/measurement-location/mock';
import { ApiError } from '@/shared/api';
import { MOCK_CONTRACTS, setMockScenario, type MockScenario } from '@/shared/api/mock';
import { AIRPORT_UTILITY_APP_STORE_URL } from '@/shared/config/survey-deeplinks';
import { BridgeError, type BridgeMethod, type NetworkChangeEvent } from '@/shared/super-app';
import { createFakeSuperAppClient, renderWithProviders, type FakeSuperAppClient } from '@/shared/test';
import { manualOnboarding } from '../model/manual-onboarding';
import type { MeasureMode } from '../model/use-measure-session';
import { MeasureSheet } from './measure-sheet';

const CONTRACT = MOCK_CONTRACTS[0].contractId;
const MODEM_MAC = 'A4:56:02:3C:11:9F';

interface SetupOptions {
  bridge?: FakeSuperAppClient;
  mode?: MeasureMode;
  name?: string;
  scenario?: Partial<MockScenario>;
  plan?: number | null;
}

function Host({
  location,
  mode,
  plan,
}: {
  location: MeasurementLocation;
  mode: MeasureMode;
  plan: number | null;
}) {
  const [open, setOpen] = useState(true);
  return open ? (
    <MeasureSheet
      contractId={CONTRACT}
      location={location}
      mode={mode}
      planDownloadMbps={plan}
      modemMac={MODEM_MAC}
      ssid="MyHome_5G"
      onClose={() => setOpen(false)}
      onRename={vi.fn()}
      onDelete={vi.fn()}
    />
  ) : (
    <p>closed</p>
  );
}

async function setup({
  bridge = createFakeSuperAppClient(),
  mode = 'measure',
  name = 'Phòng khách',
  scenario = {},
  plan = 300,
}: SetupOptions = {}) {
  setMockScenario({ survey: 'full', ...scenario });
  resetMeasurementLocationMockDb();
  const location = (await measurementLocationApi.list(CONTRACT)).find((item) => item.name === name)!;
  const utils = renderWithProviders(<Host location={location} mode={mode} plan={plan} />, {
    superAppClient: bridge,
  });
  return { ...utils, bridge, location };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  manualOnboarding.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('MeasureSheet — Android bridge', () => {
  it('measures with SPEED, saves and shows the level + toast', async () => {
    const save = vi.spyOn(measurementLocationApi, 'createMeasurement');
    const { bridge } = await setup();

    expect(await screen.findByText('Chất lượng Wi-fi: Trung bình')).toBeInTheDocument();
    expect(bridge.measureWifiSpeed).toHaveBeenCalledWith({ durationSec: 8 });
    expect(bridge.readWifiRssi).not.toHaveBeenCalled();
    expect(save.mock.calls[0]![1]).toMatchObject({ method: 'SPEED', downloadMbps: 200, latencyMs: 20 });
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu kết quả Phòng khách: Trung bình');
    expect(screen.getByRole('button', { name: 'Đo lại' })).toBeEnabled();
    expect(screen.queryByText(/dBm|Mbps/)).not.toBeInTheDocument();
  });

  it('uses RSSI when the backend selects it', async () => {
    const save = vi.spyOn(measurementLocationApi, 'createMeasurement');
    const { bridge } = await setup({ scenario: { androidMethod: 'RSSI' } });

    expect(await screen.findByText('Chất lượng Wi-fi: Khoẻ')).toBeInTheDocument();
    expect(bridge.readWifiRssi).toHaveBeenCalledWith({ durationSec: 8 });
    expect(bridge.measureWifiSpeed).not.toHaveBeenCalled();
    expect(save.mock.calls[0]![1]).toMatchObject({ method: 'RSSI', source: 'BRIDGE', rssiDbm: -55 });
  });

  it('shows the measuring state with the 8-second hint and a disabled "Đo lại"', async () => {
    const bridge = createFakeSuperAppClient();
    bridge.measureWifiSpeed.mockReturnValueOnce(new Promise(() => {}));
    await setup({ bridge });

    expect(await screen.findByText('Đang đo sóng Wi-fi...')).toBeInTheDocument();
    expect(screen.getByText('Đứng giữa phòng, giữ máy trong khoảng 8 giây')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Tiến độ đo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đo lại' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đổi tên Phòng khách' })).toBeDisabled();
  });

  it('aborts without saving when the sheet is closed while measuring', async () => {
    const save = vi.spyOn(measurementLocationApi, 'createMeasurement');
    const bridge = createFakeSuperAppClient();
    const measurement = deferred<{ downloadMbps: number; latencyMs: number }>();
    bridge.measureWifiSpeed.mockReturnValueOnce(measurement.promise);
    await setup({ bridge });

    await screen.findByText('Đang đo sóng Wi-fi...');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.getByText('closed')).toBeInTheDocument();
    await act(async () => measurement.resolve({ downloadMbps: 250, latencyMs: 10 }));
    expect(save).not.toHaveBeenCalled();
  });

  it('cancels when the network changes during the measurement (LS-01)', async () => {
    const save = vi.spyOn(measurementLocationApi, 'createMeasurement');
    const bridge = createFakeSuperAppClient();
    const measurement = deferred<{ downloadMbps: number; latencyMs: number }>();
    bridge.measureWifiSpeed.mockReturnValueOnce(measurement.promise);
    let emit: (event: NetworkChangeEvent) => void = () => {};
    const unsubscribe = vi.fn();
    bridge.onNetworkChange.mockImplementation((callback) => {
      emit = callback;
      return unsubscribe;
    });
    await setup({ bridge });

    await screen.findByText('Đang đo sóng Wi-fi...');
    act(() => emit({ type: 'CELLULAR', bssid: null }));
    expect(await screen.findByText('Đã huỷ lượt đo')).toBeInTheDocument();
    await act(async () => measurement.resolve({ downloadMbps: 250, latencyMs: 10 }));
    expect(save).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it.each([
    ['cellular', { type: 'CELLULAR', vpnActive: false }, 'Điện thoại đang dùng 4G'],
    ['VPN', { type: 'WIFI', vpnActive: true }, 'Điện thoại đang bật VPN'],
  ] as const)('blocks on %s with the reason and "Thử lại"', async (_label, network, reason) => {
    const bridge = createFakeSuperAppClient();
    bridge.getNetworkInfo.mockResolvedValueOnce(network);
    await setup({ bridge });

    expect(await screen.findByText('Chưa đủ điều kiện đo')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(reason))).toBeInTheDocument();
    expect(bridge.measureWifiSpeed).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Đo thử, không lưu' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chất lượng Wi-fi: Trung bình')).toBeInTheDocument();
  });

  it('on another modem BSSID offers a trial measurement that is not saved (DK-04)', async () => {
    const save = vi.spyOn(measurementLocationApi, 'createMeasurement');
    const bridge = createFakeSuperAppClient();
    bridge.getWifiInfo.mockResolvedValueOnce({
      bssid: '00:11:22:33:44:55',
      ipAddress: null,
      macAddress: null,
    });
    await setup({ bridge });

    expect(await screen.findByText(/không thuộc modem của hợp đồng này/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đo thử, không lưu' }));
    expect(await screen.findByText('Chất lượng Wi-fi: Trung bình')).toBeInTheDocument();
    expect(screen.getByText('Kết quả đo thử trên Wi-fi khác, không được lưu.')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('skips checks the host does not support', async () => {
    const supported: BridgeMethod[] = ['getMiniAppToken', 'getAppInfo', 'measureWifiSpeed'];
    const bridge = createFakeSuperAppClient(undefined, supported);
    await setup({ bridge });

    expect(await screen.findByText('Chất lượng Wi-fi: Trung bình')).toBeInTheDocument();
    expect(bridge.getNetworkInfo).not.toHaveBeenCalled();
    expect(bridge.getWifiInfo).not.toHaveBeenCalled();
  });

  it('shows the bridge error with "Thử lại" when measuring fails', async () => {
    const bridge = createFakeSuperAppClient();
    bridge.measureWifiSpeed.mockRejectedValueOnce(new BridgeError('PERMISSION_DENIED', 'measureWifiSpeed'));
    await setup({ bridge });

    expect(await screen.findByText('Chưa đo được')).toBeInTheDocument();
    expect(screen.getByText('Ứng dụng chưa được cấp quyền cần thiết.')).toBeInTheDocument();
  });

  it('keeps an unsynced result in memory and resends it with the same idempotency key (LS-02)', async () => {
    const original = measurementLocationApi.createMeasurement.bind(measurementLocationApi);
    const save = vi
      .spyOn(measurementLocationApi, 'createMeasurement')
      .mockRejectedValueOnce(new ApiError('network', null, 'offline'))
      .mockImplementation(original);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await setup();

    expect(await screen.findByText('Chưa đồng bộ')).toBeInTheDocument();
    expect(screen.getByText('Chất lượng Wi-fi: Trung bình')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại' }));

    await waitFor(() => expect(screen.queryByText('Chưa đồng bộ')).not.toBeInTheDocument());
    expect(save).toHaveBeenCalledTimes(2);
    const [first, second] = save.mock.calls;
    expect(second![3]).toBe(first![3]);
    expect(second![2]).toBe(first![2]);
    expect(setItem).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu kết quả');
  });

  it('view mode shows the latest result and the history, then tags the new measurement', async () => {
    await setup({ mode: 'view' });

    expect(await screen.findByText('Chất lượng Wi-fi: Khoẻ')).toBeInTheDocument();
    const history = await screen.findByRole('region', { name: /Lịch sử đo/ });
    expect(within(history).getAllByRole('listitem')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Đo lại' }));
    await screen.findByText('Chất lượng Wi-fi: Trung bình');
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: /Lịch sử đo/ })).getAllByRole('listitem'),
      ).toHaveLength(4),
    );
    expect(within(screen.getByRole('region', { name: /Lịch sử đo/ })).getByText('Mới')).toBeInTheDocument();
  });

  it('hides the history for the first measurement (LS-05)', async () => {
    await setup({ mode: 'view', name: 'Phòng bếp' });

    expect(await screen.findByText('Chất lượng Wi-fi: Trung bình')).toBeInTheDocument();
    await act(async () => {});
    expect(screen.queryByRole('region', { name: /Lịch sử đo/ })).not.toBeInTheDocument();
  });

  it('falls back to manual input on Android without a bridge meter', async () => {
    const bridge = createFakeSuperAppClient(undefined, ['getMiniAppToken', 'getAppInfo']);
    await setup({ bridge });

    expect(await screen.findByLabelText('Nhập chỉ số RSSI')).toBeInTheDocument();
    expect(screen.getByText(/đo bằng ứng dụng đo sóng/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AirPort Utility' })).not.toBeInTheDocument();
  });
});

describe('MeasureSheet — iPhone manual RSSI', () => {
  function iosBridge() {
    const bridge = createFakeSuperAppClient();
    bridge.getAppInfo.mockResolvedValue({ platform: 'IOS', appVersion: '1.0.0', osVersion: '18' });
    return bridge;
  }

  it('need-app: opens the App Store and switches to "Đo bằng AirPort Utility" on return', async () => {
    const { bridge } = await setup({ bridge: iosBridge() });

    expect(await screen.findByText('Cần ứng dụng AirPort Utility')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Tải trên App Store' }));
    expect(bridge.openDeeplink).toHaveBeenCalledWith(AIRPORT_UTILITY_APP_STORE_URL);
    expect(bridge.measureWifiSpeed).not.toHaveBeenCalled();

    setVisibility('hidden');
    setVisibility('visible');
    expect(await screen.findByText('Đo bằng AirPort Utility')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nhập kết quả đo' }));
    expect(screen.getByLabelText('Nhập chỉ số RSSI')).toBeInTheDocument();
  });

  it('guide-full → validated RSSI input with live preview → saves as IOS/MANUAL', async () => {
    const save = vi.spyOn(measurementLocationApi, 'createMeasurement');
    await setup({ bridge: iosBridge() });

    fireEvent.click(await screen.findByRole('button', { name: 'Tôi đã có ứng dụng' }));
    expect(screen.getByText('Hướng dẫn đo sóng trên iPhone')).toBeInTheDocument();
    expect(screen.getByText('MyHome_5G')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tôi đã có kết quả, nhập ngay' }));

    const input = screen.getByLabelText('Nhập chỉ số RSSI');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    const saveButton = screen.getByRole('button', { name: 'Lưu kết quả' });
    expect(saveButton).toBeDisabled();

    fireEvent.change(input, { target: { value: '25' } });
    expect(screen.getByText('Giá trị hợp lệ từ -30 đến -100 dBm.')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();

    fireEvent.change(input, { target: { value: '-6x5' } });
    expect(input).toHaveValue('65');
    expect(screen.getByText('Mức sóng tương ứng: Trung bình')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '58' } });
    expect(screen.getByText('Mức sóng tương ứng: Khoẻ')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '70' } });
    expect(screen.getByText('Mức sóng tương ứng: Yếu')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '65' } });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);
    expect(await screen.findByText('Chất lượng Wi-fi: Trung bình')).toBeInTheDocument();
    expect(save.mock.calls[0]![1]).toEqual({
      method: 'RSSI',
      platform: 'IOS',
      source: 'MANUAL',
      rssiDbm: -65,
    });

    // Second measurement in the same session: short guide with a link to the full one.
    fireEvent.click(screen.getByRole('button', { name: 'Đo lại' }));
    expect(await screen.findByRole('button', { name: 'Xem hướng dẫn' })).toBeInTheDocument();
    expect(screen.queryByText('Hướng dẫn đo sóng trên iPhone')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem hướng dẫn' }));
    expect(screen.getByText('Hướng dẫn đo sóng trên iPhone')).toBeInTheDocument();
  });

  it('starts with the short guide when AirPort Utility and the guide were already seen', async () => {
    manualOnboarding.markAppInstalled();
    manualOnboarding.markGuideSeen();
    await setup({ bridge: iosBridge() });

    expect(await screen.findByRole('button', { name: 'Xem hướng dẫn' })).toBeInTheDocument();
    expect(screen.queryByText('Cần ứng dụng AirPort Utility')).not.toBeInTheDocument();
  });
});
