import { describe, expect, it } from 'vitest';
import type { ConnectedDevice } from './connected-device-schema';
import {
  deviceFilterFromParam,
  isSelfDevice,
  parseDeviceFilterParam,
  resolveDeviceIcon,
  sortConnectedDevices,
} from './connected-device-view';

const device = (patch: Partial<ConnectedDevice> & Pick<ConnectedDevice, 'macAddress'>): ConnectedDevice => ({
  name: null,
  kind: 'CLIENT',
  status: 'CONNECTED',
  blockable: true,
  ...patch,
});

describe('sortConnectedDevices', () => {
  const devices = [
    device({ macAddress: '00:00:00:00:00:01', name: 'Zeta', status: 'BLOCKED' }),
    device({
      macAddress: '00:00:00:00:00:02',
      name: 'beta',
      status: 'DISCONNECTED',
      trafficSharePercent: 50,
    }),
    device({ macAddress: '00:00:00:00:00:03', name: null, status: 'CONNECTED' }),
    device({ macAddress: '00:00:00:00:00:04', name: 'Ánh', status: 'CONNECTED', trafficSharePercent: 10 }),
    device({ macAddress: '00:00:00:00:00:05', name: 'alpha', status: 'CONNECTED', trafficSharePercent: 70 }),
  ];

  it('orders CONNECTED → DISCONNECTED → BLOCKED, then by name (unnamed last)', () => {
    expect(sortConnectedDevices(devices).map((item) => item.name)).toEqual([
      'alpha',
      'Ánh',
      null,
      'beta',
      'Zeta',
    ]);
  });

  it('puts the highest traffic share first when sorting by traffic', () => {
    expect(sortConnectedDevices(devices, { byTraffic: true }).map((item) => item.name)).toEqual([
      'alpha',
      'beta',
      'Ánh',
      null,
      'Zeta',
    ]);
  });

  it('does not mutate the input', () => {
    const copy = [...devices];
    sortConnectedDevices(devices);
    expect(devices).toEqual(copy);
  });
});

describe('filter params', () => {
  it.each([
    ['all', 'all', 'ALL'],
    ['connected', 'connected', 'CONNECTED'],
    ['blocked', 'blocked', 'BLOCKED'],
    ['weird', 'all', 'ALL'],
    [null, 'all', 'ALL'],
  ] as const)('%s → %s', (raw, param, filter) => {
    expect(parseDeviceFilterParam(raw)).toBe(param);
    expect(deviceFilterFromParam(parseDeviceFilterParam(raw))).toBe(filter);
  });
});

describe('resolveDeviceIcon', () => {
  it('prefers the chosen icon, else defaults by kind and connection type', () => {
    expect(resolveDeviceIcon({ icon: 'TV', kind: 'CLIENT' })).toBe('TV');
    expect(resolveDeviceIcon({ kind: 'MESH' })).toBe('MESH');
    expect(resolveDeviceIcon({ kind: 'AP' })).toBe('ROUTER');
    expect(resolveDeviceIcon({ kind: 'CLIENT', connectionType: 'WIRED' })).toBe('LAPTOP');
    expect(resolveDeviceIcon({ kind: 'CLIENT', connectionType: 'WIRELESS' })).toBe('PHONE');
  });
});

describe('isSelfDevice', () => {
  const phone = device({ macAddress: '3A:1F:00:AB:CD:EF', ipAddress: '192.168.1.23' });

  it('matches by MAC (any case/separator) or by IP', () => {
    expect(isSelfDevice(phone, { selfMacAddress: '3a-1f-00-ab-cd-ef', selfIpAddress: null })).toBe(true);
    expect(isSelfDevice(phone, { selfMacAddress: '02:00:00:00:00:00', selfIpAddress: '192.168.1.23' })).toBe(
      true,
    );
  });

  it('is false without identity or when nothing matches', () => {
    expect(isSelfDevice(phone, null)).toBe(false);
    expect(isSelfDevice(phone, { selfMacAddress: null, selfIpAddress: null })).toBe(false);
    expect(
      isSelfDevice({ ...phone, ipAddress: null }, { selfMacAddress: null, selfIpAddress: '192.168.1.23' }),
    ).toBe(false);
  });
});
