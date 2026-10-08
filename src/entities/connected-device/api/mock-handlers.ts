import { http } from 'msw';
import type { ApiSchemas } from '@/shared/api';
import {
  apiError,
  apiPath,
  checkDevice,
  createMockCommand,
  getMockCommand,
  idempotent,
  isMockDeviceBusy,
  mockDelay,
  nowIso,
  ok,
  settleMockCommands,
} from '@/shared/api/mock';

type ConnectedDeviceDto = ApiSchemas['ConnectedDevice'];

/**
 * Typed with the generated contract. XD: 10 devices — 5 connected, 1 blocked, 4 disconnected.
 * `trafficSharePercent` is null in production until G-14; the mock fills it so the Quality tab's
 * HOGGED action (`/devices?sort=traffic&focus=<mac>`, top device = Samsung Smart TV 72%) can be shown.
 */
export const connectedDeviceFixtures: ConnectedDeviceDto[] = [
  {
    macAddress: 'A4:F4:C2:00:00:03',
    name: 'Mesh tầng 2',
    icon: 'MESH',
    kind: 'MESH',
    status: 'CONNECTED',
    connectionType: 'WIRED',
    ipAddress: '192.168.1.2',
    wifiSsid: null,
    blockable: false,
    trafficSharePercent: null,
  },
  {
    macAddress: '3A:1F:00:AB:CD:EF',
    name: 'iPhone của Minh',
    icon: 'PHONE',
    kind: 'CLIENT',
    status: 'CONNECTED',
    connectionType: 'WIRELESS',
    ipAddress: '192.168.1.23',
    wifiSsid: null,
    blockable: true,
    trafficSharePercent: 8,
  },
  {
    macAddress: '58:2F:40:11:22:33',
    name: 'Samsung Smart TV',
    icon: 'TV',
    kind: 'CLIENT',
    status: 'CONNECTED',
    connectionType: 'WIRELESS',
    ipAddress: '192.168.1.31',
    wifiSsid: null,
    blockable: true,
    trafficSharePercent: 72,
  },
  {
    macAddress: 'F0:18:98:44:55:66',
    name: 'MacBook Air',
    icon: 'LAPTOP',
    kind: 'CLIENT',
    status: 'CONNECTED',
    connectionType: 'WIRELESS',
    ipAddress: '192.168.1.40',
    wifiSsid: null,
    blockable: true,
    trafficSharePercent: 14,
  },
  {
    macAddress: '00:11:32:77:88:99',
    name: 'Synology NAS',
    icon: 'STORAGE',
    kind: 'CLIENT',
    status: 'CONNECTED',
    connectionType: 'WIRED',
    ipAddress: '192.168.1.50',
    wifiSsid: null,
    blockable: true,
    trafficSharePercent: 5,
  },
  {
    macAddress: '7C:49:EB:12:34:56',
    name: 'Camera cổng',
    icon: 'CAMERA',
    kind: 'CLIENT',
    status: 'BLOCKED',
    connectionType: 'WIRELESS',
    ipAddress: null,
    wifiSsid: null,
    blockable: true,
    trafficSharePercent: null,
  },
  {
    macAddress: 'D2:9C:1A:BB:CC:01',
    name: 'iPad của Lan',
    icon: 'TABLET',
    kind: 'CLIENT',
    status: 'DISCONNECTED',
    connectionType: 'WIRELESS',
    ipAddress: null,
    wifiSsid: null,
    blockable: true,
    trafficSharePercent: null,
  },
  {
    macAddress: 'E6:41:7F:BB:CC:02',
    name: 'Galaxy A54',
    icon: 'PHONE',
    kind: 'CLIENT',
    status: 'DISCONNECTED',
    connectionType: 'WIRELESS',
    ipAddress: null,
    wifiSsid: null,
    blockable: true,
    trafficSharePercent: null,
  },
  {
    macAddress: '9A:0B:3C:BB:CC:03',
    name: 'Laptop công ty',
    icon: 'LAPTOP',
    kind: 'CLIENT',
    status: 'DISCONNECTED',
    connectionType: 'WIRED',
    ipAddress: null,
    wifiSsid: null,
    blockable: true,
    trafficSharePercent: null,
  },
  {
    macAddress: 'B8:27:EB:BB:CC:04',
    name: 'android-5f2c1e',
    icon: 'PHONE',
    kind: 'CLIENT',
    status: 'DISCONNECTED',
    connectionType: 'WIRELESS',
    ipAddress: null,
    wifiSsid: null,
    blockable: true,
    trafficSharePercent: null,
  },
];

interface DeviceRecord {
  device: ConnectedDeviceDto;
  /** Name reported by the modem; restored when the custom name is cleared. */
  hostName: string;
  hidden: boolean;
}

let states = new Map<string, DeviceRecord[]>();

function recordsFor(serialNumber: string): DeviceRecord[] {
  let records = states.get(serialNumber);
  if (!records) {
    records = connectedDeviceFixtures.map((device) => ({
      device: { ...device },
      hostName: device.name,
      hidden: false,
    }));
    states.set(serialNumber, records);
  }
  return records;
}

const statusOrder: Record<ConnectedDeviceDto['status'], number> = {
  CONNECTED: 0,
  DISCONNECTED: 1,
  BLOCKED: 2,
};

function visibleDevices(serialNumber: string): ConnectedDeviceDto[] {
  return recordsFor(serialNumber)
    .filter((record) => !record.hidden)
    .map((record) => record.device)
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name, 'vi'));
}

function findRecord(serialNumber: string, mac: string): DeviceRecord | undefined {
  return recordsFor(serialNumber).find(
    (record) => !record.hidden && record.device.macAddress === mac.toUpperCase(),
  );
}

interface SelfBody {
  selfMacAddress?: string | null;
  selfIpAddress?: string | null;
}

function isSelf(device: ConnectedDeviceDto, body: SelfBody | undefined): boolean {
  if (!body) return false;
  return (
    (!!body.selfMacAddress && body.selfMacAddress.toUpperCase() === device.macAddress) ||
    (!!body.selfIpAddress && body.selfIpAddress === device.ipAddress)
  );
}

function commandResponse(command: ApiSchemas['Command']) {
  const location = `/mesh/v1/commands/${command.commandId}`;
  const status = command.state === 'CONFIRMED' ? 200 : 202;
  return {
    response: ok(command, { status, headers: { Location: location } }),
    replay: () => ok(getMockCommand(command.commandId), { status, headers: { Location: location } }),
  };
}

const listMeta = (): ApiSchemas['ReadMeta'] => ({
  source: 'CACHE',
  updatedAt: nowIso(-20_000),
  stale: false,
});
const devicePath = '/mesh/v1/devices/:serialNumber/connected-devices/:macAddress';

export const connectedDeviceMockHandlers = [
  http.get(apiPath('/mesh/v1/devices/:serialNumber/connected-devices'), async ({ request, params }) => {
    await mockDelay();
    settleMockCommands();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber);
    if (denied) return denied;
    const status = new URL(request.url).searchParams.get('status');
    const devices = visibleDevices(serialNumber).filter((device) => !status || device.status === status);
    return ok(devices, { meta: listMeta() });
  }),

  http.get(apiPath(devicePath), async ({ request, params }) => {
    await mockDelay();
    settleMockCommands();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber);
    if (denied) return denied;
    const record = findRecord(serialNumber, String(params.macAddress));
    return record ? ok(record.device, { meta: listMeta() }) : apiError(404, 'NOT_FOUND');
  }),

  http.patch(apiPath(devicePath), async ({ request, params }) => {
    await mockDelay();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber, { requireOnline: false });
    if (denied) return denied;
    return idempotent(request, (raw) => {
      const record = findRecord(serialNumber, String(params.macAddress));
      if (!record) return apiError(404, 'NOT_FOUND');
      const body = (raw ?? {}) as { name?: string | null; icon?: ConnectedDeviceDto['icon'] };
      if (typeof body.name === 'string' && body.name.trim().length > 32) {
        return apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'name', code: 'TOO_LONG' }] });
      }
      if (body.name !== undefined) {
        // Empty or null name clears the custom name (TB-07).
        record.device.name = body.name?.trim() ? body.name.trim() : record.hostName;
      }
      if (body.icon) record.device.icon = body.icon;
      return ok(record.device);
    });
  }),

  http.post(apiPath(`${devicePath}/block`), async ({ request, params }) => {
    await mockDelay();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber);
    if (denied) return denied;
    return idempotent(request, (raw) => {
      const record = findRecord(serialNumber, String(params.macAddress));
      if (!record) return apiError(404, 'NOT_FOUND');
      if (!record.device.blockable || isSelf(record.device, raw as SelfBody)) {
        return apiError(409, 'DEVICE_NOT_BLOCKABLE');
      }
      if (record.device.status === 'BLOCKED') {
        return commandResponse(createMockCommand({ type: 'CLIENT_BLOCK', serialNumber, immediate: true }));
      }
      if (isMockDeviceBusy(serialNumber)) return apiError(409, 'DEVICE_BUSY', { retryAfterSec: 5 });
      return commandResponse(
        createMockCommand({
          type: 'CLIENT_BLOCK',
          serialNumber,
          apply: () => {
            record.device.status = 'BLOCKED';
            record.device.ipAddress = null;
          },
        }),
      );
    });
  }),

  http.post(apiPath(`${devicePath}/unblock`), async ({ request, params }) => {
    await mockDelay();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber);
    if (denied) return denied;
    return idempotent(request, () => {
      const record = findRecord(serialNumber, String(params.macAddress));
      if (!record) return apiError(404, 'NOT_FOUND');
      if (record.device.status !== 'BLOCKED') {
        return commandResponse(createMockCommand({ type: 'CLIENT_UNBLOCK', serialNumber, immediate: true }));
      }
      if (isMockDeviceBusy(serialNumber)) return apiError(409, 'DEVICE_BUSY', { retryAfterSec: 5 });
      return commandResponse(
        createMockCommand({
          type: 'CLIENT_UNBLOCK',
          serialNumber,
          apply: () => {
            record.device.status = 'DISCONNECTED';
          },
        }),
      );
    });
  }),

  http.delete(apiPath(devicePath), async ({ request, params }) => {
    await mockDelay();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber);
    if (denied) return denied;
    return idempotent(request, (raw) => {
      const record = findRecord(serialNumber, String(params.macAddress));
      if (!record) return apiError(404, 'NOT_FOUND');
      if (!record.device.blockable || isSelf(record.device, raw as SelfBody)) {
        return apiError(409, 'DEVICE_NOT_BLOCKABLE');
      }
      const hide = () => {
        record.device.status = 'BLOCKED';
        record.hidden = true;
      };
      if (record.device.status === 'BLOCKED') {
        // Already blocked: only hide, answer 200 CONFIRMED.
        return commandResponse(
          createMockCommand({ type: 'CLIENT_BLOCK', serialNumber, immediate: true, apply: hide }),
        );
      }
      if (isMockDeviceBusy(serialNumber)) return apiError(409, 'DEVICE_BUSY', { retryAfterSec: 5 });
      return commandResponse(createMockCommand({ type: 'CLIENT_BLOCK', serialNumber, apply: hide }));
    });
  }),
];

export function resetConnectedDeviceMockDb(): void {
  states = new Map();
}
