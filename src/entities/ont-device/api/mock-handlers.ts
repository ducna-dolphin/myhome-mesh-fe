import { http } from 'msw';
import type { ApiSchemas } from '@/shared/api';
import {
  apiError,
  apiPath,
  checkDevice,
  countMockReboots,
  createMockCommand,
  getMockCommand,
  idempotent,
  isMockDeviceBusy,
  MOCK_CONTRACTS,
  mockDelay,
  nowIso,
  ok,
  settleMockCommands,
} from '@/shared/api/mock';

type DeviceDto = ApiSchemas['Device'];

/** Typed with the generated contract (drift → typecheck error). Values follow XD "Mesh - Modem". */
export const ontDeviceFixtures: DeviceDto[] = [
  {
    serialNumber: MOCK_CONTRACTS[0].serialNumber,
    modelName: 'AX3000CV2',
    displayName: 'AX3000CV2',
    macAddress: 'A4:56:02:3C:11:9F',
    wanIpAddress: '100.70.17.14',
    firmwareVersion: '0.10.2',
    uptimeSec: 3 * 86_400 + 9 * 3_600 + 33 * 60,
    totalTrafficBytes: Math.round(485.62 * 1024 ** 3),
    temperatureCelsius: 42,
  },
  {
    serialNumber: MOCK_CONTRACTS[1].serialNumber,
    modelName: 'iGate GW240-H',
    displayName: 'Modem nhà bà',
    macAddress: 'A4:56:02:7E:22:10',
    wanIpAddress: '100.70.33.201',
    firmwareVersion: '2.4.1',
    uptimeSec: null,
    totalTrafficBytes: null,
    temperatureCelsius: null,
  },
  {
    serialNumber: MOCK_CONTRACTS[2].serialNumber,
    modelName: 'AX3000CV2',
    displayName: 'AX3000CV2',
    macAddress: 'A4:56:02:90:AB:01',
    wanIpAddress: null,
    firmwareVersion: '0.10.2',
    uptimeSec: 26 * 3_600,
    totalTrafficBytes: null,
    temperatureCelsius: 39.5,
  },
];

const REBOOT_LIMIT = 3;
const REBOOT_WINDOW_MS = 30 * 60_000;

let devices = new Map<string, DeviceDto>();

interface ReadOverride {
  stale?: boolean;
  errors?: ApiSchemas['PartialErrors'];
}
let readOverride: ReadOverride = {};

/** Forces `meta.stale` and/or partial `errors[]` on `GET /mesh/v1/devices/{serialNumber}`. */
export function setOntDeviceMockRead(override: ReadOverride): void {
  readOverride = override;
}

function reset(): void {
  devices = new Map(ontDeviceFixtures.map((device) => [device.serialNumber, { ...device }]));
}
reset();

const deviceErrors = (device: DeviceDto): ApiSchemas['PartialErrors'] =>
  device.uptimeSec === null && device.totalTrafficBytes === null
    ? [{ code: 'UPSTREAM_TIMEOUT', target: 'traffic' }]
    : [];

export const ontDeviceMockHandlers = [
  http.get(apiPath('/mesh/v1/devices/:serialNumber'), async ({ request, params }) => {
    await mockDelay();
    settleMockCommands();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber);
    if (denied) return denied;
    const device = devices.get(serialNumber);
    if (!device) return apiError(404, 'NOT_FOUND');
    const stale = readOverride.stale ?? false;
    return ok(device, {
      meta: { source: 'CACHE', updatedAt: nowIso(stale ? -20 * 60_000 : -30_000), stale },
      errors: readOverride.errors ?? deviceErrors(device),
    });
  }),

  http.patch(apiPath('/mesh/v1/devices/:serialNumber'), async ({ request, params }) => {
    await mockDelay();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber, { requireOnline: false });
    if (denied) return denied;
    return idempotent(request, (body) => {
      const displayName = (body as { displayName?: unknown } | undefined)?.displayName;
      if (typeof displayName !== 'string' || displayName.trim().length === 0) {
        return apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'displayName', code: 'REQUIRED' }] });
      }
      if (displayName.trim().length > 32) {
        return apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'displayName', code: 'TOO_LONG' }] });
      }
      const updated = { ...devices.get(serialNumber)!, displayName: displayName.trim() };
      devices.set(serialNumber, updated);
      return ok(updated);
    });
  }),

  http.post(apiPath('/mesh/v1/devices/:serialNumber/reboot'), async ({ request, params }) => {
    await mockDelay();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber);
    if (denied) return denied;
    return idempotent(request, () => {
      if (isMockDeviceBusy(serialNumber)) return apiError(409, 'DEVICE_BUSY', { retryAfterSec: 5 });
      if (countMockReboots(serialNumber, REBOOT_WINDOW_MS) >= REBOOT_LIMIT) {
        return apiError(429, 'RATE_LIMITED', { retryAfterSec: 600 });
      }
      const command = createMockCommand({ type: 'REBOOT', serialNumber });
      const location = `/mesh/v1/commands/${command.commandId}`;
      return {
        response: ok(command, { status: 202, headers: { Location: location } }),
        replay: () => ok(getMockCommand(command.commandId), { status: 202, headers: { Location: location } }),
      };
    });
  }),
];

export function resetOntDeviceMockDb(): void {
  reset();
  readOverride = {};
}
