import { http } from 'msw';
import type { ApiSchemas } from '@/shared/api';
import {
  apiError,
  apiPath,
  checkContract,
  checkDevice,
  getMockScenario,
  idempotent,
  isMockDeviceBusy,
  lastMockRebootAt,
  mockDelay,
  ok,
  type MockScenario,
} from '@/shared/api/mock';
import { createUuid } from '@/shared/lib';

type HealthCheckDto = ApiSchemas['HealthCheck'];
type HealthCheckItemDto = ApiSchemas['HealthCheckItem'];

type Outcome = MockScenario['health'];

const lineStable: HealthCheckItemDto = {
  itemType: 'INTERNET_LINE',
  state: 'DONE',
  status: 'STABLE',
  action: null,
  dropCount: 0,
  errorCode: null,
};
const wifiPass: HealthCheckItemDto = {
  itemType: 'WIFI_SIGNAL',
  state: 'DONE',
  status: 'PASS',
  action: null,
  errorCode: null,
};
const devicesNormal: HealthCheckItemDto = {
  itemType: 'CONNECTED_DEVICES',
  state: 'DONE',
  status: 'NORMAL',
  action: 'OPEN_DEVICES_TAB',
  activeDeviceCount: 5,
  topDevice: null,
  errorCode: null,
};
const devicesHogged: HealthCheckItemDto = {
  itemType: 'CONNECTED_DEVICES',
  state: 'DONE',
  status: 'HOGGED',
  action: 'OPEN_DEVICES_TAB',
  activeDeviceCount: 5,
  topDevice: { macAddress: '58:2F:40:11:22:33', name: 'Samsung Smart TV', sharePercent: 72 },
  errorCode: null,
};

/** Final item results per scenario (`VITE_MOCK_HEALTH`); typed with the generated contract. */
export const healthCheckItemFixtures: Record<Outcome, HealthCheckItemDto[]> = {
  stable: [lineStable, wifiPass, devicesNormal],
  unstable: [
    {
      itemType: 'INTERNET_LINE',
      state: 'DONE',
      status: 'UNSTABLE',
      action: 'RESET_MODEM',
      dropCount: 3,
      errorCode: null,
    },
    { itemType: 'WIFI_SIGNAL', state: 'DONE', status: 'FAIL', action: 'ORDER_MESH', errorCode: null },
    devicesHogged,
  ],
  down: [
    {
      itemType: 'INTERNET_LINE',
      state: 'DONE',
      status: 'DISCONNECTED',
      action: 'REPORT_FAULT',
      dropCount: null,
      errorCode: null,
    },
    { itemType: 'WIFI_SIGNAL', state: 'FAILED', status: null, action: null, errorCode: 'DEVICE_OFFLINE' },
    {
      itemType: 'CONNECTED_DEVICES',
      state: 'FAILED',
      status: null,
      action: null,
      errorCode: 'DEVICE_OFFLINE',
    },
  ],
  /** Wi-Fi turned off → "Bật Wi-Fi" action. */
  off: [
    lineStable,
    { itemType: 'WIFI_SIGNAL', state: 'DONE', status: 'OFF', action: 'ENABLE_WIFI', errorCode: null },
    { ...devicesNormal, activeDeviceCount: 0 },
  ],
  /** Weak Wi-Fi → "Đặt mua Mesh". */
  fail: [
    lineStable,
    { itemType: 'WIFI_SIGNAL', state: 'DONE', status: 'FAIL', action: 'ORDER_MESH', errorCode: null },
    devicesNormal,
  ],
  /** One device takes most of the bandwidth. */
  hogged: [lineStable, wifiPass, devicesHogged],
};

/** Each item runs ~2s, so a run takes ~6s (CL-05: line → Wi-Fi → devices). */
export const MOCK_HEALTH_ITEM_MS = 2_000;
const FRESH_MS = 30 * 60_000;

interface StoredCheck {
  checkId: string;
  outcome: Outcome;
  startedAt: number;
  /** Custom final items set by tests; overrides the outcome fixture. */
  items?: HealthCheckItemDto[];
}

let checks = new Map<string, StoredCheck[]>();
let customItems: HealthCheckItemDto[] | null = null;

const ISSUE_STATUSES = new Set(['UNSTABLE', 'DISCONNECTED', 'FAIL', 'OFF', 'HOGGED']);

/** Run summary: any FAILED item → INCOMPLETE (BR-70), else count the issues. */
function summarize(items: HealthCheckItemDto[]): Pick<HealthCheckDto, 'overallStatus' | 'issueCount'> {
  const issueCount = items.filter((item) => item.status && ISSUE_STATUSES.has(item.status)).length;
  if (items.some((item) => item.state === 'FAILED')) return { overallStatus: 'INCOMPLETE', issueCount };
  return { overallStatus: issueCount > 0 ? 'ISSUES_FOUND' : 'NO_ISSUE', issueCount };
}

/**
 * Final items for runs created from now on (and for the seeded "45 minutes ago" run), e.g. Wi-Fi
 * `OFF` + `ENABLE_WIFI`. `null` goes back to the `VITE_MOCK_HEALTH` / `setMockScenario` outcome.
 */
export function setHealthCheckMockItems(items: HealthCheckItemDto[] | null): void {
  customItems = items;
}

const currentOutcome = (): Outcome =>
  getMockScenario().device === 'offline' ? 'down' : getMockScenario().health;

/** Builds the API view of a run from the elapsed time. */
export function viewHealthCheck(check: StoredCheck, now = Date.now()): HealthCheckDto {
  const elapsed = now - check.startedAt;
  const finalItems = check.items ?? healthCheckItemFixtures[check.outcome];
  const finalSummary = summarize(finalItems);
  const done = elapsed >= finalItems.length * MOCK_HEALTH_ITEM_MS;
  const items: HealthCheckItemDto[] = finalItems.map((item, index) => {
    const finishedAt = (index + 1) * MOCK_HEALTH_ITEM_MS;
    if (elapsed >= finishedAt) return item;
    const state = elapsed >= index * MOCK_HEALTH_ITEM_MS ? 'RUNNING' : 'PENDING';
    return { itemType: item.itemType, state, status: null, action: null, errorCode: null };
  });
  return {
    checkId: check.checkId,
    state: done ? 'DONE' : 'RUNNING',
    overallStatus: done ? finalSummary.overallStatus : null,
    issueCount: done ? finalSummary.issueCount : null,
    items,
    createdAt: new Date(check.startedAt).toISOString(),
    finishedAt: done
      ? new Date(check.startedAt + finalItems.length * MOCK_HEALTH_ITEM_MS).toISOString()
      : null,
  };
}

function newCheck(startedAt: number): StoredCheck {
  return {
    checkId: createUuid(),
    outcome: currentOutcome(),
    startedAt,
    ...(customItems ? { items: customItems } : {}),
  };
}

function checksFor(serialNumber: string): StoredCheck[] {
  let list = checks.get(serialNumber);
  if (!list) {
    // A completed run from 45 minutes ago: entering the tab starts a new run (CL-03).
    list = [newCheck(Date.now() - 45 * 60_000)];
    checks.set(serialNumber, list);
  }
  return list;
}

export const healthCheckMockHandlers = [
  http.get(apiPath('/mesh/v1/devices/:serialNumber/health-checks'), async ({ request, params }) => {
    await mockDelay();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber, { requireOnline: false });
    if (denied) return denied;
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit') ?? 1), 1), 5);
    return ok(
      checksFor(serialNumber)
        .slice(0, limit)
        .map((check) => viewHealthCheck(check)),
    );
  }),

  http.post(apiPath('/mesh/v1/devices/:serialNumber/health-checks'), async ({ request, params }) => {
    await mockDelay();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber, { requireOnline: false });
    if (denied) return denied;
    return idempotent(request, () => {
      const list = checksFor(serialNumber);
      const latest = list[0];
      const now = Date.now();
      if (latest) {
        const view = viewHealthCheck(latest, now);
        const location = `/mesh/v1/devices/${serialNumber}/health-checks/${latest.checkId}`;
        if (view.state === 'RUNNING') return ok(view, { status: 202, headers: { Location: location } });
        const rebootAt = lastMockRebootAt(serialNumber);
        const invalidated = rebootAt !== null && rebootAt > latest.startedAt;
        if (now - latest.startedAt < FRESH_MS && !invalidated) return ok(view);
      }
      // Shares the device lock with write commands (P6-01).
      if (isMockDeviceBusy(serialNumber)) return apiError(409, 'DEVICE_BUSY', { retryAfterSec: 5 });
      const created = newCheck(now);
      list.unshift(created);
      const location = `/mesh/v1/devices/${serialNumber}/health-checks/${created.checkId}`;
      return {
        response: ok(viewHealthCheck(created, now), { status: 202, headers: { Location: location } }),
        replay: () => ok(viewHealthCheck(created), { status: 202, headers: { Location: location } }),
      };
    });
  }),

  http.get(apiPath('/mesh/v1/devices/:serialNumber/health-checks/:checkId'), async ({ request, params }) => {
    await mockDelay(150);
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber, { requireOnline: false });
    if (denied) return denied;
    const check = checksFor(serialNumber).find((item) => item.checkId === String(params.checkId));
    return check ? ok(viewHealthCheck(check)) : apiError(404, 'NOT_FOUND');
  }),

  http.post(apiPath('/link/v1/contract-links/:contractId/fault-reports'), async ({ request, params }) => {
    await mockDelay();
    const contractId = String(params.contractId);
    const denied = checkContract(request, contractId);
    if (denied) return denied;
    return idempotent(request, () => {
      const ticketCode = `BH-${Date.now().toString().slice(-8)}`;
      return ok(
        { ticketCode, createdAt: new Date().toISOString() },
        {
          status: 201,
          headers: { Location: `/link/v1/contract-links/${contractId}/fault-reports/${ticketCode}` },
        },
      );
    });
  }),
];

export function resetHealthCheckMockDb(): void {
  checks = new Map();
  customItems = null;
}
