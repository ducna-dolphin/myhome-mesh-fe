import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commandApi } from '@/entities/command';
import { wifiNetworkApi, wifiNetworkKeys, type WifiNetwork } from '@/entities/wifi-network';
import { setWifiNetworkMockOptions } from '@/entities/wifi-network/mock';
import { ApiError } from '@/shared/api';
import { MOCK_CONTRACTS } from '@/shared/api/mock';
import { advanceFakeTime, installFakeClock, renderWithProviders } from '@/shared/test';
import { evaluateWifiNetworkForm } from '../model/wifi-network-form';
import { UpdateWifiNetworkForm } from './update-wifi-network-form';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;
const network: WifiNetwork = {
  wifiIndex: 0,
  ssid: 'MyHome_WF6',
  band: 'BAND_2_4GHZ',
  enabled: true,
  securityMode: 'WPA2-PSK',
};

function renderForm() {
  const onDone = vi.fn();
  const view = renderWithProviders(
    <UpdateWifiNetworkForm serialNumber={SERIAL} network={network} onDone={onDone} />,
  );
  return { ...view, onDone };
}

const ssidInput = () => screen.getByLabelText('Tên Wi-fi (SSID)');
const passwordInput = () => screen.getByLabelText('Mật khẩu Wi-fi');
const saveButton = () => screen.getByRole('button', { name: /Lưu thay đổi|Đang áp dụng/ });

function saveAndConfirm() {
  fireEvent.click(saveButton());
  const dialog = screen.getByRole('alertdialog', { name: 'Lưu thay đổi Wi-Fi?' });
  expect(dialog).toHaveTextContent('Các thiết bị đang kết nối sẽ cần kết nối lại');
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('evaluateWifiNetworkForm', () => {
  const evaluate = (ssid: string, password = '') => evaluateWifiNetworkForm(network, { ssid, password });

  it('builds a diff-only merge patch', () => {
    expect(evaluate('MyHome_WF6')).toMatchObject({ patch: null, isValid: true });
    expect(evaluate('New').patch).toEqual({ ssid: 'New' });
    expect(evaluate('MyHome_WF6', 'abcdefgh').patch).toEqual({ password: 'abcdefgh' });
    expect(evaluate('New', 'abcdefgh').patch).toEqual({ ssid: 'New', password: 'abcdefgh' });
  });

  it('validates the SSID: 1–32 bytes, no control characters', () => {
    expect(evaluate('').errors.ssid).toBe('edit.errors.ssidRequired');
    expect(evaluate('   ').errors.ssid).toBe('edit.errors.ssidRequired');
    expect(evaluate('x'.repeat(32)).errors.ssid).toBeUndefined();
    expect(evaluate('x'.repeat(33)).errors.ssid).toBe('edit.errors.ssidTooLong');
    // 26 characters but 34 UTF-8 bytes.
    expect(evaluate('Wifi nhà mình ở tầng hai ạ').errors.ssid).toBe('edit.errors.ssidTooLong');
    expect(evaluate('bad\tname').errors.ssid).toBe('edit.errors.ssidInvalid');
  });

  it('validates the password: empty or 8–63 printable ASCII', () => {
    expect(evaluate('MyHome_WF6', '').errors.password).toBeUndefined();
    expect(evaluate('MyHome_WF6', 'short').errors.password).toBe('edit.errors.passwordLength');
    expect(evaluate('MyHome_WF6', 'x'.repeat(64)).errors.password).toBe('edit.errors.passwordLength');
    expect(evaluate('MyHome_WF6', 'x'.repeat(63)).errors.password).toBeUndefined();
    expect(evaluate('MyHome_WF6', 'mật khẩu mới').errors.password).toBe('edit.errors.passwordInvalid');
    expect(evaluate('MyHome_WF6', 'P@ss w0rd;:"\\').errors.password).toBeUndefined();
  });
});

describe('UpdateWifiNetworkForm', () => {
  it('keeps "Lưu thay đổi" disabled until something valid changed and shows inline errors', () => {
    renderForm();
    expect(ssidInput()).toHaveValue('MyHome_WF6');
    expect(passwordInput()).toHaveValue('');
    expect(saveButton()).toBeDisabled();

    fireEvent.change(ssidInput(), { target: { value: '' } });
    expect(screen.getByText('Vui lòng nhập tên Wi-Fi.')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    fireEvent.change(ssidInput(), { target: { value: 'MyHome_New' } });
    expect(saveButton()).toBeEnabled();

    fireEvent.change(passwordInput(), { target: { value: '123' } });
    expect(screen.getByText('Mật khẩu cần từ 8 đến 63 ký tự.')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('sends only the changed SSID, polls the command and goes back on CONFIRMED', async () => {
    installFakeClock();
    const update = vi.spyOn(wifiNetworkApi, 'update');
    const { onDone, queryClient } = renderForm();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.change(ssidInput(), { target: { value: 'MyHome_New' } });
    saveAndConfirm();
    await advanceFakeTime(0);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(SERIAL, 0, { ssid: 'MyHome_New' }, expect.any(String));
    expect(saveButton()).toHaveTextContent('Đang áp dụng…');
    expect(onDone).not.toHaveBeenCalled();

    await advanceFakeTime(2_500);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Đã lưu thay đổi Wi-Fi')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: wifiNetworkKeys.list(SERIAL) });
  });

  it('sends only the password when the SSID is unchanged', async () => {
    const update = vi.spyOn(wifiNetworkApi, 'update');
    renderForm();
    fireEvent.change(passwordInput(), { target: { value: 'NewPass@123' } });
    saveAndConfirm();
    await vi.waitFor(() =>
      expect(update).toHaveBeenCalledWith(SERIAL, 0, { password: 'NewPass@123' }, expect.any(String)),
    );
  });

  it('keeps no password in the MutationCache once the request settles', async () => {
    installFakeClock();
    const update = vi.spyOn(wifiNetworkApi, 'update');
    update.mockRejectedValueOnce(new ApiError('network', null, 'offline'));
    const { queryClient } = renderForm();
    const cachedVariables = () =>
      JSON.stringify(
        queryClient
          .getMutationCache()
          .getAll()
          .map((mutation) => mutation.state.variables),
      );

    fireEvent.change(passwordInput(), { target: { value: 'NewPass@123' } });
    saveAndConfirm();
    await advanceFakeTime(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Không có kết nối mạng');
    expect(cachedVariables()).not.toContain('NewPass@123');

    saveAndConfirm();
    await advanceFakeTime(0);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1]?.[3]).toBe(update.mock.calls[0]?.[3]);
    expect(cachedVariables()).not.toContain('NewPass@123');
  });

  it('uses a new idempotency key once the password is edited again', async () => {
    const update = vi.spyOn(wifiNetworkApi, 'update');
    update.mockRejectedValueOnce(new ApiError('network', null, 'offline'));
    renderForm();

    fireEvent.change(passwordInput(), { target: { value: 'NewPass@123' } });
    saveAndConfirm();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.change(passwordInput(), { target: { value: 'NewPass@124' } });
    saveAndConfirm();
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1]?.[2]).toEqual({ password: 'NewPass@124' });
    expect(update.mock.calls[1]?.[3]).not.toBe(update.mock.calls[0]?.[3]);
  });

  it('reuses the idempotency key when retrying after a network error', async () => {
    const update = vi.spyOn(wifiNetworkApi, 'update');
    update.mockRejectedValueOnce(new ApiError('network', null, 'offline'));
    const { onDone } = renderForm();

    fireEvent.change(ssidInput(), { target: { value: 'MyHome_New' } });
    saveAndConfirm();
    expect(await screen.findByRole('alert')).toHaveTextContent('Không có kết nối mạng');
    expect(onDone).not.toHaveBeenCalled();

    saveAndConfirm();
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1]?.[3]).toBe(update.mock.calls[0]?.[3]);
    expect(update.mock.calls[1]?.[2]).toEqual({ ssid: 'MyHome_New' });
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1), { timeout: 4_000 });
  });

  it('treats UNKNOWN as sent and goes back', async () => {
    installFakeClock();
    setWifiNetworkMockOptions({ commandOutcome: 'UNKNOWN' });
    const { onDone } = renderForm();
    fireEvent.change(ssidInput(), { target: { value: 'MyHome_New' } });
    saveAndConfirm();
    await advanceFakeTime(2_500);

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Đã gửi yêu cầu, đang chờ modem xác nhận')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('treats a network error after the 202 (phone left this Wi-Fi) as pending', async () => {
    installFakeClock();
    vi.spyOn(commandApi, 'get').mockRejectedValue(new ApiError('network', null, 'offline'));
    const { onDone } = renderForm();
    fireEvent.change(passwordInput(), { target: { value: 'NewPass@123' } });
    saveAndConfirm();
    await advanceFakeTime(2_500);

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Đã gửi yêu cầu, đang chờ modem xác nhận')).toBeInTheDocument();
  });

  it('shows an inline error when the command FAILS and lets the user retry with a new key', async () => {
    installFakeClock();
    setWifiNetworkMockOptions({ commandOutcome: 'FAILED', commandErrorCode: 'DEVICE_BUSY' });
    const update = vi.spyOn(wifiNetworkApi, 'update');
    const { onDone } = renderForm();
    fireEvent.change(ssidInput(), { target: { value: 'MyHome_New' } });
    saveAndConfirm();
    await advanceFakeTime(2_500);

    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Chưa lưu được thay đổi. Modem đang thực hiện thao tác khác. Vui lòng thử lại sau.',
    );
    expect(saveButton()).toBeEnabled();

    setWifiNetworkMockOptions({ commandOutcome: 'CONFIRMED' });
    saveAndConfirm();
    await advanceFakeTime(2_500);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1]?.[3]).not.toBe(update.mock.calls[0]?.[3]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
