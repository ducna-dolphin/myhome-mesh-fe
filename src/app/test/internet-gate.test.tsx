import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockServer } from '@/app/mocks/mock-server';
import { resetMockDb } from '@/app/mocks';
import { miniAppTokens } from '@/shared/api';
import { apiError, apiPath, MOCK_CONTRACTS, ok, setMockScenario, type MockScenario } from '@/shared/api/mock';
import { bridgeMethods } from '@/shared/super-app';
import { createFakeSuperAppClient } from '@/shared/test';
import { formatTime } from '@/shared/lib';
import { contractCardMemory } from '@/widgets/contract-card';
import { renderApp } from './render-app';

function scenario(patch: Partial<MockScenario>) {
  setMockScenario(patch);
  resetMockDb();
}

const contractCard = () => screen.getByRole('button', { name: 'Thông tin hợp đồng' }).closest('section')!;

describe('Internet contract gate', () => {
  beforeEach(() => contractCardMemory.reset());

  it('shows a skeleton while contracts load, then the card and tabs', async () => {
    scenario({ contracts: 'one' });
    renderApp({ entries: ['/wifi'] });
    expect(screen.getByText('Đang tải thông tin hợp đồng').closest('[role="status"]')).toHaveAttribute(
      'aria-busy',
      'true',
    );

    expect(await screen.findByRole('tablist', { name: 'Chức năng Internet' })).toBeInTheDocument();
    const card = contractCard();
    expect(await within(card).findByText('VNPT-HN-0123446')).toBeInTheDocument();
    expect(within(card).getByText('12/05/2023')).toBeInTheDocument();
    expect(within(card).getByText('31/12/2026')).toBeInTheDocument();
    expect(within(card).getByText('30/09/2026')).toBeInTheDocument();
    expect(within(card).queryByRole('combobox')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Danh sách Wi-fi/ })).toBeInTheDocument();
  });

  it('collapses and expands the contract card', async () => {
    scenario({ contracts: 'one' });
    renderApp({ entries: ['/wifi'] });
    const trigger = await screen.findByRole('button', { name: 'Thông tin hợp đồng' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('remembers a collapsed contract card for the session (in memory, not localStorage)', async () => {
    scenario({ contracts: 'one' });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const first = renderApp({ entries: ['/wifi'] });
    fireEvent.click(await screen.findByRole('button', { name: 'Thông tin hợp đồng' }));
    first.unmount();

    // Coming back (e.g. from a sub-page, which remounts the Internet layout) keeps it collapsed.
    renderApp({ entries: ['/devices'] });
    expect(await screen.findByRole('button', { name: 'Thông tin hợp đồng' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(setItem.mock.calls.some(([key]) => /contract/i.test(String(key)))).toBe(false);
    setItem.mockRestore();
  });

  it('shows the no-service page when the user has no contract', async () => {
    scenario({ contracts: 'none' });
    renderApp({ entries: ['/modem'] });
    expect(await screen.findByRole('button', { name: 'Đăng ký ngay' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('retries the contract lookup with a fresh MiniApp token', async () => {
    scenario({ contracts: 'one' });
    mockServer.use(
      http.get(apiPath('/link/v1/contract-links'), () => apiError(503, 'SERVICE_UNAVAILABLE'), {
        once: true,
      }),
    );
    const authorizations: Array<string | null> = [];
    const onRequest = ({ request }: { request: Request }) => {
      if (new URL(request.url).pathname.endsWith('/link/v1/contract-links'))
        authorizations.push(request.headers.get('Authorization'));
    };
    mockServer.events.on('request:start', onRequest);
    const refresh = vi.spyOn(miniAppTokens, 'refresh');
    renderApp({ entries: ['/wifi'] });
    expect(await screen.findByRole('alert')).toHaveTextContent('Hệ thống đang bận');

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByRole('tablist')).toBeInTheDocument();
    mockServer.events.removeListener('request:start', onRequest);
    refresh.mockRestore();
    // The refetch carries the token obtained by the retry, not the one that hit the error.
    expect(authorizations.length).toBeGreaterThanOrEqual(2);
    expect(authorizations.at(-1)).toBe(`Bearer ${await miniAppTokens.getToken()}`);
    expect(authorizations.at(-1)).not.toBe(authorizations[0]);
  });

  it('falls back to a plain refetch when getMiniAppToken is unsupported', async () => {
    scenario({ contracts: 'one' });
    mockServer.use(
      http.get(apiPath('/link/v1/contract-links'), () => apiError(503, 'SERVICE_UNAVAILABLE'), {
        once: true,
      }),
    );
    const client = createFakeSuperAppClient(
      undefined,
      bridgeMethods.filter((method) => method !== 'getMiniAppToken'),
    );
    renderApp({ entries: ['/wifi'], superAppClient: client });
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('tablist')).toBeInTheDocument();
    expect(client.getMiniAppToken).not.toHaveBeenCalled();
  });

  it('shows only the contract picker until one of several contracts is selected', async () => {
    scenario({ contracts: 'many' });
    mockServer.use(
      http.get(apiPath('/link/v1/contract-links'), () =>
        ok(
          MOCK_CONTRACTS.map(({ contractId, contractCode }) => ({
            contractId,
            contractCode,
            selected: false,
          })),
        ),
      ),
    );
    renderApp({ entries: ['/wifi'] });
    const select = await screen.findByRole('combobox', { name: /Chọn hợp đồng/ });
    expect(select).toHaveValue('');
    expect(screen.getByText(/Bạn có nhiều hợp đồng Internet/)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText('Mã hợp đồng')).not.toBeInTheDocument();
  });

  it('switches contract from the dropdown and reloads the card', async () => {
    scenario({ contracts: 'many' });
    renderApp({ entries: ['/wifi'] });
    const select = await screen.findByRole('combobox', { name: /Chọn hợp đồng/ });
    const card = contractCard();
    expect(await within(card).findByText('VNPT-HN-0123446', { selector: 'dd' })).toBeInTheDocument();
    expect(within(select).getAllByRole('option')).toHaveLength(3);

    fireEvent.change(select, { target: { value: MOCK_CONTRACTS[1].contractId } });

    expect(await within(card).findByText('VNPT-HN-0456789', { selector: 'dd' })).toBeInTheDocument();
    expect(select).toHaveValue(MOCK_CONTRACTS[1].contractId);
    // Second fixture: payment source failed (errors[] target `payment`) and no expiry date.
    const paymentRow = within(card).getByText('Lần thanh toán gần nhất').closest('div')!;
    expect(within(paymentRow).getByText('—')).toBeInTheDocument();
    const expiryRow = within(card).getByText('Ngày hết hạn').closest('div')!;
    expect(within(expiryRow).getByText('—')).toBeInTheDocument();
  });

  it('keeps card and tabs but asks for a modem when the contract has no serial number', async () => {
    scenario({ contracts: 'one', serial: 'missing' });
    renderApp({ entries: ['/devices'] });
    expect(await screen.findByText('Chưa xác định được modem của hợp đồng')).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thông tin hợp đồng' })).toBeInTheDocument();
  });

  it('labels stale contract data with its update time', async () => {
    scenario({ contracts: 'one' });
    const updatedAt = '2026-10-08T03:15:00Z';
    mockServer.use(
      http.get(apiPath('/link/v1/contract-links/:contractId'), () =>
        ok(
          {
            contractId: MOCK_CONTRACTS[0].contractId,
            contractCode: MOCK_CONTRACTS[0].contractCode,
            selected: true,
            registrationDate: '2023-05-12',
            expiryDate: null,
            lastPaymentDate: null,
            serialNumber: MOCK_CONTRACTS[0].serialNumber,
          },
          { meta: { source: 'CACHE', stale: true, updatedAt } },
        ),
      ),
    );
    renderApp({ entries: ['/wifi'] });
    expect(await screen.findByText(`Cập nhật lúc ${formatTime(updatedAt)}`)).toBeInTheDocument();
  });

  it('opens payment in the host', async () => {
    scenario({ contracts: 'one' });
    const { superAppClient } = renderApp({ entries: ['/wifi'] });
    fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán / Gia hạn ngay' }));
    expect(superAppClient.openPayment).toHaveBeenCalledWith({ contractCode: 'VNPT-HN-0123446' });
  });

  it('hides the payment button when openPayment is unsupported', async () => {
    scenario({ contracts: 'one' });
    const client = createFakeSuperAppClient(
      undefined,
      bridgeMethods.filter((method) => method !== 'openPayment'),
    );
    renderApp({ entries: ['/wifi'], superAppClient: client });
    expect(await screen.findByText('VNPT-HN-0123446', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thanh toán / Gia hạn ngay' })).not.toBeInTheDocument();
  });
});
