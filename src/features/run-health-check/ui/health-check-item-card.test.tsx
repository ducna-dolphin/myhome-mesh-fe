import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HealthCheckItem } from '@/entities/health-check';
import {
  devicesTabUrl,
  presentHealthItem,
  progressPercent,
  stepStates,
} from '../lib/health-check-presentation';
import { HealthCheckItemCard } from './health-check-item-card';

const line = (patch: Partial<HealthCheckItem>): HealthCheckItem => ({
  itemType: 'INTERNET_LINE',
  state: 'DONE',
  ...patch,
});
const wifi = (patch: Partial<HealthCheckItem>): HealthCheckItem =>
  line({ itemType: 'WIFI_SIGNAL', ...patch });
const devices = (patch: Partial<HealthCheckItem>): HealthCheckItem =>
  line({ itemType: 'CONNECTED_DEVICES', ...patch });

// Copy from SRC-HEALTH-SCRIPT@2026-10-07 §3 (LLD P6-01).
const cases: [string, HealthCheckItem, string, 'success' | 'warning' | 'danger' | 'neutral'][] = [
  [
    'STABLE, 0 drops',
    line({ status: 'STABLE', dropCount: 0 }),
    'Ổn định, hôm nay không lần nào rớt mạng',
    'success',
  ],
  [
    'STABLE, unknown drops',
    line({ status: 'STABLE', dropCount: null }),
    'Ổn định, hôm nay không lần nào rớt mạng',
    'success',
  ],
  [
    'UNSTABLE with drops',
    line({ status: 'UNSTABLE', dropCount: 6 }),
    'Chập chờn, hôm nay rớt mạng 6 lần',
    'warning',
  ],
  ['UNSTABLE without count', line({ status: 'UNSTABLE', dropCount: null }), 'Chập chờn', 'warning'],
  [
    'DISCONNECTED',
    line({ status: 'DISCONNECTED' }),
    'Mất kết nốiVui lòng kiểm tra lại nguồn Modem',
    'danger',
  ],
  ['PASS', wifi({ status: 'PASS' }), 'Đạt, sóng phủ đều trong nhà', 'success'],
  ['FAIL', wifi({ status: 'FAIL' }), 'Chưa đạt, có chỗ trong nhà sóng còn yếu', 'warning'],
  ['OFF', wifi({ status: 'OFF' }), 'Không có, Wi-Fi đang tắt', 'neutral'],
  ['NORMAL', devices({ status: 'NORMAL', activeDeviceCount: 10 }), '10 thiết bị đang dùng mạng', 'success'],
  [
    'HOGGED by a named device',
    devices({
      status: 'HOGGED',
      topDevice: { macAddress: 'AA', name: 'Tivi phòng khách', sharePercent: 71 },
    }),
    'Tivi phòng khách đang chiếm 71% đường truyền',
    'warning',
  ],
  [
    'HOGGED by an unnamed device',
    devices({ status: 'HOGGED', topDevice: { macAddress: 'AA', name: null, sharePercent: 65 } }),
    'Một thiết bị đang chiếm 65% đường truyền',
    'warning',
  ],
  [
    'HOGGED by device count',
    devices({ status: 'HOGGED', activeDeviceCount: 30, topDevice: null }),
    '30 thiết bị đang dùng mạng, nhiều hơn mức khuyến nghị',
    'warning',
  ],
  ['PENDING', wifi({ state: 'PENDING', status: null }), 'Chờ bước trước xong', 'neutral'],
  ['RUNNING', wifi({ state: 'RUNNING', status: null }), 'Đang kiểm tra…', 'neutral'],
  [
    'FAILED',
    wifi({ state: 'FAILED', status: null, errorCode: 'UPSTREAM_TIMEOUT' }),
    'Chưa kiểm tra được phần này',
    'neutral',
  ],
];

describe('HealthCheckItemCard copy', () => {
  it.each(cases)('%s', (_name, item, expected, tone) => {
    const { container } = render(<HealthCheckItemCard item={item} />);
    expect(container.querySelector('.health-item__body')?.textContent).toContain(expected);
    expect(presentHealthItem(item).tone).toBe(tone);
  });

  it('never shows raw technical terms', () => {
    for (const [, item] of cases) {
      const { container, unmount } = render(<HealthCheckItemCard item={item} />);
      expect(container.textContent).not.toMatch(/rxPower|dBm|PPPoE|jitter|WLAN|SSID|lease/i);
      unmount();
    }
  });

  it('makes the whole card a button when onOpen is given', () => {
    const onOpen = vi.fn();
    render(
      <HealthCheckItemCard item={devices({ status: 'NORMAL', activeDeviceCount: 3 })} onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Thiết bị kết nối/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('health-check presentation helpers', () => {
  it('builds the Devices tab URL (HOGGED sorts by traffic and focuses the top device)', () => {
    expect(devicesTabUrl(devices({ status: 'NORMAL' }))).toBe('/devices');
    expect(
      devicesTabUrl(
        devices({ status: 'HOGGED', topDevice: { macAddress: '58:2F:40:11:22:33', sharePercent: 72 } }),
      ),
    ).toBe('/devices?sort=traffic&focus=58%3A2F%3A40%3A11%3A22%3A33');
    expect(devicesTabUrl(devices({ status: 'HOGGED', topDevice: null }))).toBe('/devices?sort=traffic');
  });

  it('computes step states and progress from item states', () => {
    const steps = stepStates(
      { checkId: 'c', state: 'RUNNING', items: [line({}), wifi({ state: 'RUNNING' })] },
      ['INTERNET_LINE', 'WIFI_SIGNAL', 'CONNECTED_DEVICES'],
    );
    expect(steps.map((step) => step.state)).toEqual(['DONE', 'RUNNING', 'PENDING']);
    expect(progressPercent(steps, false)).toBe(50);
    expect(progressPercent(steps, true)).toBe(100);
    expect(progressPercent(stepStates(null, ['INTERNET_LINE']), false)).toBe(0);
  });
});
