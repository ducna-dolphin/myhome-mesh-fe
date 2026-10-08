import {
  normalizeMac,
  type ConnectedDevice,
  type ConnectedDeviceFilter,
  type ConnectedDeviceStatus,
  type DeviceIcon,
  type SelfDeviceIdentity,
} from './connected-device-schema';

/** Display order of the "Tất cả" list: connected first, then inactive, then blocked (LLD §8.2). */
export const CONNECTED_DEVICE_STATUS_ORDER: Record<ConnectedDeviceStatus, number> = {
  CONNECTED: 0,
  DISCONNECTED: 1,
  BLOCKED: 2,
};

const nameCollator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });

function compareByName(a: ConnectedDevice, b: ConnectedDevice): number {
  // Unnamed devices go last inside their group, then by MAC so the order is stable.
  if (a.name && b.name)
    return nameCollator.compare(a.name, b.name) || a.macAddress.localeCompare(b.macAddress);
  if (a.name) return -1;
  if (b.name) return 1;
  return a.macAddress.localeCompare(b.macAddress);
}

export interface SortConnectedDevicesOptions {
  /** `?sort=traffic` (Quality tab HOGGED): highest `trafficSharePercent` first, unknown last. */
  byTraffic?: boolean;
}

/** Pure sort used by the Devices tab: status → name, or traffic share first when asked. */
export function sortConnectedDevices(
  devices: readonly ConnectedDevice[],
  { byTraffic = false }: SortConnectedDevicesOptions = {},
): ConnectedDevice[] {
  return [...devices].sort((a, b) => {
    if (byTraffic) {
      const shareA = a.trafficSharePercent ?? -1;
      const shareB = b.trafficSharePercent ?? -1;
      if (shareA !== shareB) return shareB - shareA;
    }
    return (
      CONNECTED_DEVICE_STATUS_ORDER[a.status] - CONNECTED_DEVICE_STATUS_ORDER[b.status] || compareByName(a, b)
    );
  });
}

/** `?filter=` values of the Devices tab. Unknown values fall back to "all". */
export const deviceFilterParams = ['all', 'connected', 'blocked'] as const;
export type DeviceFilterParam = (typeof deviceFilterParams)[number];

const filterByParam: Record<DeviceFilterParam, ConnectedDeviceFilter> = {
  all: 'ALL',
  connected: 'CONNECTED',
  blocked: 'BLOCKED',
};

export function parseDeviceFilterParam(value: string | null): DeviceFilterParam {
  return (deviceFilterParams as readonly string[]).includes(value ?? '')
    ? (value as DeviceFilterParam)
    : 'all';
}

export function deviceFilterFromParam(param: DeviceFilterParam): ConnectedDeviceFilter {
  return filterByParam[param];
}

/** Icon chosen by the user, else a default by kind / connection type. */
export function resolveDeviceIcon(
  device: Pick<ConnectedDevice, 'icon' | 'kind' | 'connectionType'>,
): DeviceIcon {
  if (device.icon) return device.icon;
  if (device.kind === 'MESH') return 'MESH';
  if (device.kind === 'AP') return 'ROUTER';
  return device.connectionType === 'WIRED' ? 'LAPTOP' : 'PHONE';
}

/**
 * The phone running the MiniApp (Q-46, S-03). MACs are often randomised per network, so the IP is
 * compared too.
 */
export function isSelfDevice(
  device: Pick<ConnectedDevice, 'macAddress' | 'ipAddress'>,
  self: SelfDeviceIdentity | null | undefined,
): boolean {
  if (!self) return false;
  if (self.selfMacAddress && normalizeMac(self.selfMacAddress) === normalizeMac(device.macAddress))
    return true;
  return Boolean(self.selfIpAddress && device.ipAddress && self.selfIpAddress === device.ipAddress);
}
