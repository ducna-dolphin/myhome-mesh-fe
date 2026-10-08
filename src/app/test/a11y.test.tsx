import { screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { configureAxe } from 'vitest-axe';
import { resetMockDb } from '@/app/mocks';
import { setMockScenario } from '@/shared/api/mock';
import { renderApp } from './render-app';

/**
 * Automated axe audit of every tab, sub-page and the main sheets in mock mode. Only serious and
 * critical violations fail. `color-contrast` needs real layout/CSS (Vitest runs with `css: false`),
 * so contrast is checked against tokens by hand instead (docs/code-standards.md).
 */
const axe = configureAxe({
  impactLevels: ['serious', 'critical'],
  rules: { 'color-contrast': { enabled: false } },
} as Parameters<typeof configureAxe>[0]);

beforeAll(() => {
  // axe probes icon ligatures with a canvas, which jsdom does not implement.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const TV_MAC = '58:2F:40:11:22:33';

async function expectNoSeriousViolations() {
  const results = await axe(document.body);
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(
    serious.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([]);
}

describe('a11y (axe, serious + critical)', () => {
  it.each([
    ['Wifi tab', '/wifi', /Phòng khách/],
    ['Thiết bị kết nối tab', '/devices', 'Samsung Smart TV'],
    ['Modem tab', '/modem', /Khởi động lại/],
    ['Chất lượng tab', '/quality', /Đường truyền/],
    ['Wi-Fi options sheet', '/wifi?sheet=wifi-options&wifiIndex=0', /Đổi tên/],
    ['Wi-Fi edit page', '/wifi/0/edit', /Lưu thay đổi/],
    ['Wi-Fi share page', '/wifi/0/share', /Chia sẻ|Lưu/],
    ['Device detail page', `/devices/${encodeURIComponent(TV_MAC)}`, /Thông tin thiết bị/],
    ['Device edit page', `/devices/${encodeURIComponent(TV_MAC)}/edit`, /Lưu/],
  ])(
    '%s has no serious violations',
    async (_name, entry, ready) => {
      renderApp({ entries: [entry] });
      await waitFor(() => expect(screen.getAllByText(ready).length).toBeGreaterThan(0), { timeout: 4_000 });
      await expectNoSeriousViolations();
      // The first case also pays the cold lazy-route import + axe start-up under a parallel suite.
    },
    15_000,
  );

  it('no-service page has no serious violations', async () => {
    setMockScenario({ contracts: 'none' });
    resetMockDb();
    renderApp({ entries: ['/wifi'] });
    await screen.findByRole('button', { name: 'Đăng ký ngay' });
    await expectNoSeriousViolations();
  });
});
