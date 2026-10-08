import { fireEvent, screen, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commandApi, type Command } from '@/entities/command';
import { connectedDeviceApi, connectedDeviceKeys, type ConnectedDevice } from '@/entities/connected-device';
import type { WithMeta } from '@/shared/api';
import { MOCK_CONTRACTS, setMockScenario } from '@/shared/api/mock';
import { advanceFakeTime, createTestQueryClient, installFakeClock, renderWithProviders } from '@/shared/test';
import { DeviceDetail } from './device-detail';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;
const TV = '58:2F:40:11:22:33';
const NAS = '00:11:32:77:88:99';
const MESH = 'A4:F4:C2:00:00:03';
const CAMERA = '7C:49:EB:12:34:56';
const SELF_PHONE = '3A:1F:00:AB:CD:EF';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderDetail(macAddress: string, queryClient = createTestQueryClient()) {
  return renderWithProviders(
    <>
      <DeviceDetail serialNumber={SERIAL} macAddress={macAddress} />
      <LocationProbe />
    </>,
    { route: `/devices/${encodeURIComponent(macAddress)}`, queryClient },
  );
}

const blockSwitch = () => screen.getByRole('switch', { name: 'Chặn kết nối Internet' });
const sentCommand = (commandId: string): Command => ({
  commandId,
  type: 'CLIENT_BLOCK',
  state: 'SENT',
  retryAfterSec: 2,
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('DeviceDetail', () => {
  it('shows the header and "Thông tin thiết bị" fields', async () => {
    renderDetail(TV);
    expect(await screen.findByRole('heading', { name: 'Samsung Smart TV' })).toBeInTheDocument();
    const info = screen.getByText('Thông tin thiết bị').parentElement!;
    const value = (label: string) => within(info).getByText(label).nextElementSibling?.textContent;
    expect(value('Loại thiết bị')).toBe('Thiết bị đầu cuối');
    expect(value('Địa chỉ MAC')).toBe(TV);
    expect(value('Địa chỉ IP')).toBe('192.168.1.31');
    expect(value('Kết nối qua')).toBe('Wi-Fi');
    expect(screen.getAllByText('Đang kết nối').length).toBeGreaterThan(0);
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: 'Xoá thiết bị khỏi kết nối' })).toBeEnabled();
  });

  it('labels wired devices "Có dây" and goes to the edit page with ✎', async () => {
    renderDetail(NAS);
    await screen.findByRole('heading', { name: 'Synology NAS' });
    expect(screen.getByText('Kết nối qua').nextElementSibling).toHaveTextContent('Có dây');
    fireEvent.click(screen.getByRole('button', { name: 'Đổi tên/Icon thiết bị' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/devices/00%3A11%3A32%3A77%3A88%3A99/edit');
  });

  it('hides block and remove controls for a Mesh node (blockable = false)', async () => {
    renderDetail(MESH);
    await screen.findByRole('heading', { name: 'Mesh tầng 2' });
    expect(screen.getByText('Loại thiết bị').nextElementSibling).toHaveTextContent('Mesh');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(
      screen.getByText('Không thể chặn thiết bị Mesh hoặc điểm truy cập, vì cả nhà sẽ mất kết nối.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xoá thiết bị khỏi kết nối' })).not.toBeInTheDocument();
  });

  it('does not let the phone running the MiniApp block or remove itself', async () => {
    const { superAppClient } = renderDetail(SELF_PHONE);
    await screen.findByRole('heading', { name: 'iPhone của Minh' });
    expect(
      (await screen.findAllByText('Đây là điện thoại bạn đang dùng nên không thể chặn hoặc xoá.')).length,
    ).toBe(2);
    expect(blockSwitch()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xoá thiết bị khỏi kết nối' })).toBeDisabled();
    expect(superAppClient.getWifiInfo).toHaveBeenCalled();
  });

  it('sends null self identity when getWifiInfo is unsupported', async () => {
    const { createFakeSuperAppClient } = await import('@/shared/test');
    const client = createFakeSuperAppClient(undefined, ['getMiniAppToken']);
    const block = vi
      .spyOn(connectedDeviceApi, 'block')
      .mockResolvedValue({ ...sentCommand('c0'), state: 'CONFIRMED' });
    renderWithProviders(<DeviceDetail serialNumber={SERIAL} macAddress={TV} />, { superAppClient: client });
    await screen.findByRole('heading', { name: 'Samsung Smart TV' });
    fireEvent.click(blockSwitch());
    fireEvent.click(screen.getByRole('button', { name: 'Chặn' }));
    await vi.waitFor(() => expect(block).toHaveBeenCalled());
    expect(block.mock.calls[0]![2]).toEqual({ selfMacAddress: null, selfIpAddress: null });
    expect(client.getWifiInfo).not.toHaveBeenCalled();
  });

  it('blocks after confirmation, polls the command and shows the confirmed state', async () => {
    const block = vi.spyOn(connectedDeviceApi, 'block');
    renderDetail(TV);
    await screen.findByRole('heading', { name: 'Samsung Smart TV' });

    installFakeClock();
    fireEvent.click(blockSwitch());
    expect(
      screen.getByText('Samsung Smart TV sẽ không truy cập được Internet cho tới khi bạn bỏ chặn.'),
    ).toBeVisible();
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Chặn' }));

    // Optimistic: checked + busy while the modem works.
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'true');
    await advanceFakeTime(100);
    expect(block).toHaveBeenCalledTimes(1);
    expect(block.mock.calls[0]![2]).toEqual({ selfMacAddress: SELF_PHONE, selfIpAddress: '192.168.1.23' });
    expect(block.mock.calls[0]![3]).toEqual(expect.any(String));
    expect(blockSwitch()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Đang gửi lệnh tới modem…')).toHaveAttribute('role', 'status');

    await advanceFakeTime(2_200);
    expect(screen.getByText('Đã chặn Samsung Smart TV')).toBeInTheDocument();
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(blockSwitch()).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('heading', { name: 'Samsung Smart TV' }).parentElement).toHaveTextContent(
      'Đã chặn',
    );
  });

  it('cancelling the confirmation sends nothing', async () => {
    const block = vi.spyOn(connectedDeviceApi, 'block');
    renderDetail(TV);
    await screen.findByRole('heading', { name: 'Samsung Smart TV' });
    fireEvent.click(blockSwitch());
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(block).not.toHaveBeenCalled();
  });

  it('rolls back the optimistic status when the command FAILED', async () => {
    vi.spyOn(connectedDeviceApi, 'block').mockResolvedValue(sentCommand('cmd-failed'));
    vi.spyOn(commandApi, 'get').mockImplementation(async (commandId) => ({
      commandId,
      type: 'CLIENT_BLOCK',
      state: 'FAILED',
      errorCode: 'VERIFY_MISMATCH',
    }));
    const queryClient = createTestQueryClient();
    await queryClient.prefetchQuery({
      queryKey: connectedDeviceKeys.list(SERIAL),
      queryFn: () => connectedDeviceApi.list(SERIAL),
    });
    renderDetail(TV, queryClient);
    await screen.findByRole('heading', { name: 'Samsung Smart TV' });

    installFakeClock();
    fireEvent.click(blockSwitch());
    fireEvent.click(screen.getByRole('button', { name: 'Chặn' }));
    await advanceFakeTime(100);
    const listStatus = () =>
      queryClient
        .getQueryData<WithMeta<ConnectedDevice[]>>(connectedDeviceKeys.list(SERIAL))
        ?.data.find((device) => device.macAddress === TV)?.status;
    expect(listStatus()).toBe('BLOCKED');

    await advanceFakeTime(2_200);
    expect(screen.getByText('Modem chưa áp dụng thay đổi. Vui lòng thử lại.')).toBeInTheDocument();
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(listStatus()).toBe('CONNECTED');
  });

  it('rolls back and explains DEVICE_NOT_BLOCKABLE (409)', async () => {
    const { ApiError } = await import('@/shared/api');
    vi.spyOn(connectedDeviceApi, 'block').mockRejectedValue(
      new ApiError('validation', 409, 'not blockable', undefined, { code: 'DEVICE_NOT_BLOCKABLE' }),
    );
    renderDetail(TV);
    await screen.findByRole('heading', { name: 'Samsung Smart TV' });
    fireEvent.click(blockSwitch());
    fireEvent.click(screen.getByRole('button', { name: 'Chặn' }));
    expect(await screen.findByText('Không thể chặn hoặc xoá thiết bị này.')).toBeInTheDocument();
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'false');
  });

  it('keeps an UNKNOWN command as pending "Đang chờ modem xác nhận"', async () => {
    vi.spyOn(connectedDeviceApi, 'block').mockResolvedValue(sentCommand('cmd-unknown'));
    vi.spyOn(commandApi, 'get').mockImplementation(async (commandId) => ({
      commandId,
      type: 'CLIENT_BLOCK',
      state: 'UNKNOWN',
      retryAfterSec: 2,
    }));
    renderDetail(TV);
    await screen.findByRole('heading', { name: 'Samsung Smart TV' });

    installFakeClock();
    fireEvent.click(blockSwitch());
    fireEvent.click(screen.getByRole('button', { name: 'Chặn' }));
    await advanceFakeTime(2_300);
    expect(screen.getByText('Đang chờ modem xác nhận. Kết quả sẽ được cập nhật sau.')).toHaveAttribute(
      'role',
      'status',
    );
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(blockSwitch()).not.toHaveAttribute('aria-busy');
    expect(screen.queryByText('Modem chưa áp dụng thay đổi. Vui lòng thử lại.')).not.toBeInTheDocument();
  });

  it('ignores a second toggle while the first command is UNKNOWN and still rolls it back on FAILED', async () => {
    vi.spyOn(connectedDeviceApi, 'block').mockResolvedValue(sentCommand('cmd-unknown'));
    const unblock = vi.spyOn(connectedDeviceApi, 'unblock');
    const get = vi.spyOn(commandApi, 'get').mockImplementation(async (commandId) => ({
      commandId,
      type: 'CLIENT_BLOCK',
      state: 'UNKNOWN',
      retryAfterSec: 2,
    }));
    const { queryClient } = renderDetail(TV);
    await screen.findByRole('heading', { name: 'Samsung Smart TV' });
    const cancel = vi.spyOn(queryClient, 'cancelQueries');

    installFakeClock();
    fireEvent.click(blockSwitch());
    fireEvent.click(screen.getByRole('button', { name: 'Chặn' }));
    expect(cancel).toHaveBeenCalledWith({ queryKey: connectedDeviceKeys.all(SERIAL) });
    await advanceFakeTime(2_300);
    expect(screen.getByText('Đang chờ modem xác nhận. Kết quả sẽ được cập nhật sau.')).toBeInTheDocument();

    fireEvent.click(blockSwitch());
    await advanceFakeTime(100);
    expect(unblock).not.toHaveBeenCalled();
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Đang chờ modem xác nhận. Kết quả sẽ được cập nhật sau.')).toBeInTheDocument();

    get.mockImplementation(async (commandId) => ({
      commandId,
      type: 'CLIENT_BLOCK',
      state: 'FAILED',
      errorCode: 'VERIFY_MISMATCH',
      retryAfterSec: 2,
    }));
    await advanceFakeTime(2_300);
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'false');
  });

  it('unblocks without a confirmation dialog', async () => {
    const unblock = vi.spyOn(connectedDeviceApi, 'unblock');
    renderDetail(CAMERA);
    await screen.findByRole('heading', { name: 'Camera cổng' });
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'true');

    installFakeClock();
    fireEvent.click(blockSwitch());
    expect(screen.queryByText('Chặn kết nối Internet?')).not.toBeInTheDocument();
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'false');
    await advanceFakeTime(100);
    expect(unblock).toHaveBeenCalledWith(SERIAL, CAMERA, expect.any(String));

    await advanceFakeTime(2_200);
    expect(screen.getByText('Đã bỏ chặn Camera cổng')).toBeInTheDocument();
    expect(blockSwitch()).toHaveAttribute('aria-checked', 'false');
  });

  it('removes the device after confirmation, drops it from the list cache and goes back', async () => {
    const remove = vi.spyOn(connectedDeviceApi, 'remove');
    const queryClient = createTestQueryClient();
    await queryClient.prefetchQuery({
      queryKey: connectedDeviceKeys.list(SERIAL),
      queryFn: () => connectedDeviceApi.list(SERIAL),
    });
    renderDetail(TV, queryClient);
    await screen.findByRole('heading', { name: 'Samsung Smart TV' });

    installFakeClock();
    fireEvent.click(screen.getByRole('button', { name: 'Xoá thiết bị khỏi kết nối' }));
    expect(
      screen.getByText(/Samsung Smart TV sẽ bị chặn Internet và ẩn khỏi danh sách thiết bị/),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cần thống nhất' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xoá' }));
    await advanceFakeTime(100);
    expect(remove).toHaveBeenCalledWith(
      SERIAL,
      TV,
      { selfMacAddress: SELF_PHONE, selfIpAddress: '192.168.1.23' },
      expect.any(String),
    );
    expect(screen.getByTestId('location')).toHaveTextContent(`/devices/${encodeURIComponent(TV)}`);

    await advanceFakeTime(2_200);
    expect(screen.getByText('Đã xoá Samsung Smart TV khỏi kết nối')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/devices$/);
    const list = queryClient.getQueryData<WithMeta<ConnectedDevice[]>>(connectedDeviceKeys.list(SERIAL));
    expect(list?.data.map((device) => device.macAddress)).not.toContain(TV);
  });

  it('shows the offline message when the modem is unreachable', async () => {
    setMockScenario({ device: 'offline' });
    renderDetail(TV);
    expect(await screen.findByRole('alert')).toHaveTextContent('Modem đang mất kết nối.');
  });

  it('shows "not found" with a link back for an unknown MAC', async () => {
    renderDetail('AA:BB:CC:DD:EE:FF');
    expect(
      await screen.findByText('Không tìm thấy thiết bị. Thiết bị có thể đã bị xoá khỏi danh sách.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về danh sách thiết bị' })).toHaveAttribute('href', '/devices');
  });
});
