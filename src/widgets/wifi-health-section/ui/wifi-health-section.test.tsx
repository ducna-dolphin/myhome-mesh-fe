import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { measurementLocationApi, type MeasurementLocation } from '@/entities/measurement-location';
import { resetMeasurementLocationMockDb } from '@/entities/measurement-location/mock';
import { ApiError } from '@/shared/api';
import { MOCK_CONTRACTS, setMockScenario, type MockScenario } from '@/shared/api/mock';
import { MESH_ORDER_DEEPLINK } from '@/shared/config/survey-deeplinks';
import { createFakeSuperAppClient, renderWithProviders } from '@/shared/test';
import { findWeakestLocation, formatShortDate, pickGuideSsid } from '../model/section-helpers';
import { WifiHealthSection } from './wifi-health-section';

const { contractId: CONTRACT, serialNumber: SERIAL } = MOCK_CONTRACTS[0];

function renderSection(survey: MockScenario['survey'] = 'full') {
  setMockScenario({ survey });
  resetMeasurementLocationMockDb();
  const bridge = createFakeSuperAppClient();
  const utils = renderWithProviders(<WifiHealthSection contractId={CONTRACT} serialNumber={SERIAL} />, {
    superAppClient: bridge,
  });
  return { ...utils, bridge };
}

const grid = () => screen.getByRole('list', { name: 'Vị trí đo sóng' });
const tileNames = () =>
  within(grid())
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.location-tile__name')?.textContent ?? '+');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const location = (
  index: number,
  latestLevel: MeasurementLocation['latestLevel'] = null,
): MeasurementLocation => ({
  locationId: `loc-${index}`,
  name: `Vị trí ${index}`,
  latestLevel,
  latestMeasuredAt: latestLevel ? '2026-09-29T02:00:00.000Z' : null,
  createdAt: `2026-09-${String(index).padStart(2, '0')}T00:00:00.000Z`,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WifiHealthSection — states', () => {
  it('shows the self-check card with the 4 conditions when there is no location', async () => {
    renderSection('empty');

    expect(await screen.findByText('Tự kiểm tra sóng từng vị trí')).toBeInTheDocument();
    for (const condition of [
      'Bạn đang ở nhà',
      'Máy kết nối đúng vào Wi-fi nhà bạn',
      'Đã tắt VPN',
      'Đang đứng ở vị trí cần đo',
    ]) {
      expect(screen.getByText(condition)).toBeInTheDocument();
    }
    expect(screen.queryByText(/\/20 vị trí/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tự đo' }));
    expect(screen.getByLabelText('Đặt tên vị trí đo')).toBeInTheDocument();
  });

  it('shows the WEAK-first grid, counter, weak alert and the Mesh banner', async () => {
    const { bridge } = renderSection('full');

    expect(await screen.findByText('5/20 vị trí')).toBeInTheDocument();
    expect(screen.getByText('Sức khoẻ Wi-fi theo khu vực')).toBeInTheDocument();
    expect(tileNames()).toEqual(['Ban công', 'Phòng ngủ', 'Phòng bếp', 'Phòng khách', 'Phòng làm việc', '+']);
    expect(within(grid()).getAllByText(/^Đo ngày \d{2}\/\d{2}\/\d{2}$/)).toHaveLength(5);
    expect(within(grid()).getByText('Yếu')).toBeInTheDocument();
    expect(screen.getByText(/đang có sóng yếu/).textContent).toBe(
      'Ban công đang có sóng yếu. Lắp thêm 1 bộ Mesh để phủ sóng tốt hơn',
    );
    expect(screen.queryByText(/khoẻ.*TB.*Yếu/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Đặt lắp thêm Mesh/ }));
    expect(bridge.openDeeplink).toHaveBeenCalledWith(MESH_ORDER_DEEPLINK);
  });

  it('hides the alert and the Mesh banner without a WEAK location', async () => {
    renderSection('partial');

    expect(await screen.findByText('3/20 vị trí')).toBeInTheDocument();
    expect(screen.queryByText(/đang có sóng yếu/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đặt lắp thêm Mesh/ })).not.toBeInTheDocument();
    expect(within(grid()).getByRole('button', { name: 'Đo ngay Phòng ngủ' })).toBeInTheDocument();
  });

  it('keeps the safety sort when the backend order is off', async () => {
    vi.spyOn(measurementLocationApi, 'list').mockResolvedValue([
      location(1, null),
      location(2, 'GOOD'),
      location(3, 'WEAK'),
      location(4, 'FAIR'),
    ]);
    renderSection();

    await screen.findByText('4/20 vị trí');
    expect(tileNames()).toEqual(['Vị trí 3', 'Vị trí 4', 'Vị trí 2', 'Vị trí 1', '+']);
  });

  it('hides "+ Thêm vị trí" at 20 locations and shows the limit caption', async () => {
    vi.spyOn(measurementLocationApi, 'list').mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => location(index + 1, 'GOOD')),
    );
    renderSection();

    expect(await screen.findByText('20/20 vị trí')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm vị trí' })).not.toBeInTheDocument();
    expect(screen.getByText('Đã đủ 20 vị trí. Xoá bớt vị trí để thêm vị trí mới.')).toBeInTheDocument();
  });

  it('shows a retryable block error without breaking the page', async () => {
    const list = vi
      .spyOn(measurementLocationApi, 'list')
      .mockRejectedValueOnce(new ApiError('server', 503, 'down'));
    renderSection();

    expect(await screen.findByText('Không tải được vị trí đo sóng.')).toBeInTheDocument();
    list.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('5/20 vị trí')).toBeInTheDocument();
  });
});

describe('WifiHealthSection — create', () => {
  it('validates duplicates (case-insensitive) and hides used suggestions', async () => {
    const create = vi.spyOn(measurementLocationApi, 'create');
    renderSection('full');

    fireEvent.click(await screen.findByRole('button', { name: 'Thêm vị trí' }));
    const sheet = screen.getByRole('dialog', { name: 'Tự đo' });
    expect(within(sheet).queryByRole('button', { name: 'Phòng khách' })).not.toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Bếp' })).toBeInTheDocument();

    fireEvent.change(within(sheet).getByLabelText('Đặt tên vị trí đo'), {
      target: { value: ' phòng KHÁCH ' },
    });
    expect(within(sheet).getByText('Tên này đã có. Vui lòng đặt tên khác.')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Lưu, đo sau' }));
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(within(sheet).getByLabelText('Đặt tên vị trí đo'), { target: { value: '' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Lưu, đo sau' }));
    expect(within(sheet).getByText('Vui lòng nhập tên vị trí.')).toBeInTheDocument();
  });

  it('focuses the name input on open, offers a clear button and trims on blur', async () => {
    renderSection('full');
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm vị trí' }));
    const sheet = screen.getByRole('dialog', { name: 'Tự đo' });
    const input = within(sheet).getByLabelText('Đặt tên vị trí đo');
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: '  Gác mái  ' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('Gác mái');

    fireEvent.click(within(sheet).getByRole('button', { name: 'Xoá nội dung Đặt tên vị trí đo' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('opens the location menu from the tile body (44px ⋮ stays as well)', async () => {
    renderSection('full');
    const name = await screen.findByText('Phòng khách', { selector: '.location-tile__name' });
    fireEvent.click(name);
    expect(screen.getByRole('dialog', { name: 'Phòng khách' })).toBeInTheDocument();
  });

  it('maps server errors under the field (409 LOCATION_LIMIT_REACHED)', async () => {
    vi.spyOn(measurementLocationApi, 'create').mockRejectedValueOnce(
      new ApiError('server', 409, 'limit', undefined, { code: 'LOCATION_LIMIT_REACHED' }),
    );
    renderSection('full');

    fireEvent.click(await screen.findByRole('button', { name: 'Thêm vị trí' }));
    fireEvent.change(screen.getByLabelText('Đặt tên vị trí đo'), { target: { value: 'Gác mái' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu, đo sau' }));
    expect(
      await screen.findByText('Đã đủ 20 vị trí. Xoá bớt vị trí để thêm vị trí mới.'),
    ).toBeInTheDocument();
  });

  it('"Lưu, đo sau" saves an unmeasured tile and shows the toast', async () => {
    renderSection('full');

    fireEvent.click(await screen.findByRole('button', { name: 'Thêm vị trí' }));
    fireEvent.change(screen.getByLabelText('Đặt tên vị trí đo'), { target: { value: 'Phòng ngủ tầng 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu, đo sau' }));

    expect(
      await screen.findByText('Đã lưu Phòng ngủ tầng 2. Bạn có thể đo bất cứ lúc nào'),
    ).toBeInTheDocument();
    expect(await screen.findByText('6/20 vị trí')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Tự đo' })).not.toBeInTheDocument();
    expect(within(grid()).getByRole('button', { name: 'Đo ngay Phòng ngủ tầng 2' })).toBeInTheDocument();
  });

  it('"Lưu & đo ngay" goes straight to measuring without the location confirm', async () => {
    const save = vi.spyOn(measurementLocationApi, 'createMeasurement');
    renderSection('full');

    fireEvent.click(await screen.findByRole('button', { name: 'Thêm vị trí' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bếp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu & đo ngay' }));

    const sheet = await screen.findByRole('dialog', { name: 'Bếp' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await within(sheet).findByText('Chất lượng Wi-fi: Trung bình')).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(within(grid()).getAllByText('Trung bình').length).toBeGreaterThanOrEqual(3));
  });
});

describe('WifiHealthSection — measure, rename, delete', () => {
  it('asks "Bạn đang ở …?" before measuring from a tile', async () => {
    renderSection('partial');

    fireEvent.click(await screen.findByRole('button', { name: 'Đo ngay Phòng ngủ' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Bạn đang ở Phòng ngủ?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Đổi vị trí khác' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Phòng ngủ' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đo ngay Phòng ngủ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đúng rồi, đo tiếp' }));
    const sheet = await screen.findByRole('dialog', { name: 'Phòng ngủ' });
    expect(await within(sheet).findByText('Chất lượng Wi-fi: Trung bình')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu kết quả Phòng ngủ: Trung bình');
  });

  it('menu "Đo lại và xem lịch sử" opens the sheet with the history', async () => {
    renderSection('full');

    fireEvent.click(await screen.findByRole('button', { name: 'Tuỳ chọn Phòng khách' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đo lại và xem lịch sử' }));
    const sheet = await screen.findByRole('dialog', { name: 'Phòng khách' });
    expect(await within(sheet).findByText('Chất lượng Wi-fi: Khoẻ')).toBeInTheDocument();
    expect(await within(sheet).findByRole('region', { name: /Lịch sử đo/ })).toBeInTheDocument();
  });

  it('renames optimistically and rolls back on error', async () => {
    const pending = deferred<MeasurementLocation>();
    vi.spyOn(measurementLocationApi, 'rename').mockReturnValueOnce(pending.promise);
    renderSection('full');

    fireEvent.click(await screen.findByRole('button', { name: 'Tuỳ chọn Phòng khách' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đổi tên vị trí' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Đổi tên vị trí' });
    const input = within(dialog).getByLabelText('Tên vị trí');
    // The dialog opens with the current name focused and selected, ready to retype.
    expect(input).toHaveFocus();
    expect((input as HTMLInputElement).selectionEnd).toBe('Phòng khách'.length);
    fireEvent.change(input, { target: { value: 'ban CÔNG' } });
    expect(within(dialog).getByText('Tên này đã có. Vui lòng đặt tên khác.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Phòng khách lớn' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(tileNames()).toContain('Phòng khách lớn'));

    await act(async () =>
      pending.reject(
        new ApiError('validation', 400, 'dup', undefined, {
          code: 'VALIDATION_FAILED',
          details: [{ field: 'name', code: 'DUPLICATE' }],
        }),
      ),
    );
    await waitFor(() => expect(tileNames()).toContain('Phòng khách'));
    expect(tileNames()).not.toContain('Phòng khách lớn');
    expect(within(dialog).getByText('Tên này đã có. Vui lòng đặt tên khác.')).toBeInTheDocument();
  });

  it('renames and keeps the history (toast)', async () => {
    renderSection('full');

    fireEvent.click(await screen.findByRole('button', { name: 'Tuỳ chọn Phòng khách' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đổi tên vị trí' }));
    fireEvent.change(screen.getByLabelText('Tên vị trí'), { target: { value: 'Phòng khách lớn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã đổi tên thành Phòng khách lớn')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const renamed = (await measurementLocationApi.list(CONTRACT)).find(
      (item) => item.name === 'Phòng khách lớn',
    )!;
    expect(await measurementLocationApi.listMeasurements(renamed.locationId)).toHaveLength(3);
  });

  it('deletes after a destructive confirm, optimistically, and rolls back on error', async () => {
    const pending = deferred<void>();
    vi.spyOn(measurementLocationApi, 'remove').mockReturnValueOnce(pending.promise);
    renderSection('full');

    fireEvent.click(await screen.findByRole('button', { name: 'Tuỳ chọn Ban công' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xoá vị trí' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Xoá vị trí?' });
    expect(dialog).toHaveTextContent(
      'Xoá vị trí Ban công. Toàn bộ lịch sử đo của vị trí này cũng sẽ bị xoá và không thể khôi phục',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xoá vị trí' }));

    await waitFor(() => expect(tileNames()).not.toContain('Ban công'));
    expect(screen.queryByText(/đang có sóng yếu/)).not.toBeInTheDocument();

    await act(async () => pending.reject(new ApiError('network', null, 'offline')));
    await waitFor(() => expect(tileNames()).toContain('Ban công'));
    expect(screen.getByRole('status')).toHaveTextContent('Chưa xoá được Ban công.');
  });

  it('deletes for real and frees a slot', async () => {
    renderSection('full');

    fireEvent.click(await screen.findByRole('button', { name: 'Tuỳ chọn Phòng bếp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xoá vị trí' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xoá vị trí' }));

    expect(await screen.findByText('Đã xoá Phòng bếp')).toBeInTheDocument();
    expect(await screen.findByText('4/20 vị trí')).toBeInTheDocument();
  });
});

describe('section helpers', () => {
  it('formats dd/MM/yy, picks the weakest and the guide SSID', () => {
    expect(formatShortDate('2026-09-29T02:00:00.000Z')).toMatch(/^29\/09\/26$/);
    expect(formatShortDate(null)).toBeNull();
    expect(findWeakestLocation([location(1, 'FAIR'), location(2, 'WEAK'), location(3, 'WEAK')])?.name).toBe(
      'Vị trí 2',
    );
    expect(findWeakestLocation([location(1, 'GOOD')])).toBeNull();
    expect(
      pickGuideSsid([
        { wifiIndex: 0, ssid: 'Home', band: 'BAND_2_4GHZ', enabled: true },
        { wifiIndex: 1, ssid: 'Home_5G', band: 'BAND_5GHZ', enabled: true },
      ]),
    ).toBe('Home_5G');
    expect(
      pickGuideSsid([
        { wifiIndex: 0, ssid: 'Home', band: 'BAND_2_4GHZ', enabled: true },
        { wifiIndex: 1, ssid: 'Home_5G', band: 'BAND_5GHZ', enabled: false },
      ]),
    ).toBe('Home');
    expect(pickGuideSsid(undefined)).toBeNull();
  });
});
