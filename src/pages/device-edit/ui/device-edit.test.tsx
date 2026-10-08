import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectedDeviceApi, connectedDeviceKeys, type ConnectedDevice } from '@/entities/connected-device';
import type { WithMeta } from '@/shared/api';
import { MOCK_CONTRACTS } from '@/shared/api/mock';
import { createTestQueryClient, renderWithProviders } from '@/shared/test';
import { DeviceEdit } from './device-edit';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;
const TV = '58:2F:40:11:22:33';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

async function renderEdit(macAddress = TV) {
  const queryClient = createTestQueryClient();
  await queryClient.prefetchQuery({
    queryKey: connectedDeviceKeys.list(SERIAL),
    queryFn: () => connectedDeviceApi.list(SERIAL),
  });
  const view = renderWithProviders(
    <>
      <DeviceEdit serialNumber={SERIAL} macAddress={macAddress} />
      <LocationProbe />
    </>,
    { route: `/devices/${encodeURIComponent(macAddress)}/edit`, queryClient },
  );
  await screen.findByRole('radiogroup', { name: 'Chọn biểu tượng thiết bị' });
  return view;
}

const nameField = () => screen.getByLabelText('Tên thiết bị');
const saveButton = () => screen.getByRole('button', { name: 'Lưu thay đổi' });
const radio = (name: string) => screen.getByRole('radio', { name });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DeviceEdit', () => {
  it('prefills name and icon and keeps "Lưu thay đổi" disabled until something changes', async () => {
    await renderEdit();
    expect(nameField()).toHaveValue('Samsung Smart TV');
    expect(radio('TV')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    expect(saveButton()).toBeDisabled();

    fireEvent.change(nameField(), { target: { value: 'TV phòng khách' } });
    expect(saveButton()).toBeEnabled();
    fireEvent.change(nameField(), { target: { value: '  Samsung Smart TV ' } });
    expect(saveButton()).toBeDisabled();

    fireEvent.click(radio('Camera'));
    expect(radio('Camera')).toHaveAttribute('aria-checked', 'true');
    expect(saveButton()).toBeEnabled();
  });

  it('rejects names longer than 32 characters', async () => {
    await renderEdit();
    fireEvent.change(nameField(), { target: { value: 'x'.repeat(33) } });
    expect(screen.getByText('Tên tối đa 32 ký tự.')).toBeInTheDocument();
    expect(nameField()).toHaveAttribute('aria-invalid', 'true');
    expect(saveButton()).toBeDisabled();
    expect(nameField()).toHaveAttribute('maxLength', '32');
  });

  it('moves and selects icons with the arrow keys (roving tabindex, wrapping)', async () => {
    await renderEdit();
    const tv = radio('TV');
    expect(tv).toHaveAttribute('tabIndex', '0');
    expect(radio('Điện thoại')).toHaveAttribute('tabIndex', '-1');
    act(() => tv.focus());

    fireEvent.keyDown(tv, { key: 'ArrowRight' });
    expect(radio('Bộ định tuyến')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Bộ định tuyến')).toHaveFocus();
    fireEvent.keyDown(radio('Bộ định tuyến'), { key: 'ArrowUp' });
    expect(radio('TV')).toHaveFocus();
    fireEvent.keyDown(radio('TV'), { key: 'End' });
    expect(radio('Camera')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(radio('Camera'), { key: 'ArrowDown' });
    expect(radio('Điện thoại')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Điện thoại')).toHaveFocus();
    fireEvent.keyDown(radio('Điện thoại'), { key: 'ArrowLeft' });
    expect(radio('Camera')).toHaveFocus();
    fireEvent.keyDown(radio('Camera'), { key: 'Home' });
    expect(radio('Điện thoại')).toHaveAttribute('aria-checked', 'true');
  });

  it('saves name + icon, updates list and detail caches and goes back', async () => {
    const update = vi.spyOn(connectedDeviceApi, 'update');
    const { queryClient } = await renderEdit();
    fireEvent.change(nameField(), { target: { value: '  TV phòng khách ' } });
    fireEvent.click(radio('Máy tính xách tay'));
    fireEvent.click(saveButton());

    expect(await screen.findByText('Đã lưu thay đổi')).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith(
      SERIAL,
      TV,
      { name: 'TV phòng khách', icon: 'LAPTOP' },
      expect.any(String),
    );
    const listed = queryClient
      .getQueryData<WithMeta<ConnectedDevice[]>>(connectedDeviceKeys.list(SERIAL))
      ?.data.find((device) => device.macAddress === TV);
    expect(listed).toMatchObject({ name: 'TV phòng khách', icon: 'LAPTOP' });
    expect(
      queryClient.getQueryData<WithMeta<ConnectedDevice>>(connectedDeviceKeys.detail(SERIAL, TV))?.data,
    ).toMatchObject({ name: 'TV phòng khách', icon: 'LAPTOP' });
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(`/devices/${encodeURIComponent(TV)}`),
    );
  });

  it('clears the custom name with an empty field and shows the hint', async () => {
    const update = vi.spyOn(connectedDeviceApi, 'update');
    await renderEdit();
    fireEvent.change(nameField(), { target: { value: 'Tên tạm' } });
    expect(screen.queryByText('Để trống để dùng lại tên modem nhận diện.')).not.toBeInTheDocument();
    fireEvent.change(nameField(), { target: { value: '   ' } });
    expect(screen.getByText('Để trống để dùng lại tên modem nhận diện.')).toBeInTheDocument();
    fireEvent.click(saveButton());
    await waitFor(() => expect(update).toHaveBeenCalledWith(SERIAL, TV, { name: null }, expect.any(String)));
    expect(await update.mock.results[0]!.value).toMatchObject({ name: 'Samsung Smart TV' });
  });

  it('keeps the form and shows a toast when saving fails', async () => {
    const { ApiError } = await import('@/shared/api');
    vi.spyOn(connectedDeviceApi, 'update').mockRejectedValue(
      new ApiError('server', 503, 'down', undefined, { code: 'SERVICE_UNAVAILABLE' }),
    );
    await renderEdit();
    fireEvent.change(nameField(), { target: { value: 'TV mới' } });
    fireEvent.click(saveButton());
    expect(
      await screen.findByText('Hệ thống đang bảo trì hoặc quá tải. Vui lòng thử lại sau.'),
    ).toBeInTheDocument();
    expect(nameField()).toHaveValue('TV mới');
    expect(screen.getByTestId('location')).toHaveTextContent('/edit');
  });
});
