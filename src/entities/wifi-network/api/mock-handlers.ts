import { http, HttpResponse } from 'msw';
import type { ApiSchemas } from '@/shared/api';
import {
  apiError,
  apiPath,
  checkDevice,
  createMockCommand,
  getMockCommand,
  idempotent,
  isMockDeviceBusy,
  type MockCommandOutcome,
  mockDelay,
  nowIso,
  ok,
  settleMockCommands,
} from '@/shared/api/mock';

type WifiNetworkDto = ApiSchemas['WifiNetwork'];

/** Typed with the generated contract. The two SSIDs of XD plus one disabled network (WF-01: list all). */
export const wifiNetworkFixtures: WifiNetworkDto[] = [
  { wifiIndex: 0, ssid: 'MyHome_WF6', band: 'BAND_2_4GHZ', enabled: true, securityMode: 'WPA2-PSK' },
  { wifiIndex: 1, ssid: 'MyHome_5G', band: 'BAND_5GHZ', enabled: true, securityMode: 'WPA2-PSK' },
  { wifiIndex: 2, ssid: 'MyHome_IoT', band: 'BAND_2_4GHZ', enabled: false, securityMode: 'WPA2-PSK' },
];

const initialPasswords: Record<number, string> = { 0: 'MyHome@2024', 1: 'MyHome5G@2024', 2: 'IoT;Home:2024' };

/**
 * Test/dev knobs for the Wi-Fi mock (reset by `resetWifiNetworkMockDb`). The shared command store
 * cannot produce `UNKNOWN`; tests simulate it by stubbing `commandApi.get`.
 */
export interface WifiNetworkMockOptions {
  /** Final state of the next PATCH commands (default CONFIRMED). */
  commandOutcome: MockCommandOutcome;
  /** `Command.errorCode` when `commandOutcome` is FAILED (default VERIFY_MISMATCH). */
  commandErrorCode: ApiSchemas['ErrorCode'];
  /** Confirmation delay of PATCH commands; `null` = store default (~2s). */
  commandSettleAfterMs: number | null;
  /** Serve the list from cache with `meta.stale = true`. */
  stale: boolean;
  /** Every reveal-password call answers 429 RATE_LIMITED. */
  revealRateLimited: boolean;
}

const defaultOptions: WifiNetworkMockOptions = {
  commandOutcome: 'CONFIRMED',
  commandErrorCode: 'VERIFY_MISMATCH',
  commandSettleAfterMs: null,
  stale: false,
  revealRateLimited: false,
};

let options: WifiNetworkMockOptions = { ...defaultOptions };

export function setWifiNetworkMockOptions(patch: Partial<WifiNetworkMockOptions>): void {
  options = { ...options, ...patch };
}

/** Proposed limit: 30 reveals per user per hour. */
const REVEAL_LIMIT = 30;
const REVEAL_WINDOW_MS = 60 * 60_000;

interface WifiState {
  networks: WifiNetworkDto[];
  passwords: Record<number, string>;
}

let states = new Map<string, WifiState>();
let reveals: number[] = [];

function stateFor(serialNumber: string): WifiState {
  let state = states.get(serialNumber);
  if (!state) {
    state = {
      networks: wifiNetworkFixtures.map((network) => ({ ...network })),
      passwords: { ...initialPasswords },
    };
    states.set(serialNumber, state);
  }
  return state;
}

interface PatchBody {
  enabled?: unknown;
  ssid?: unknown;
  password?: unknown;
}

function validatePatch(body: PatchBody | undefined): ApiSchemas['ErrorResponse']['error']['details'] {
  const details: NonNullable<ApiSchemas['ErrorResponse']['error']['details']> = [];
  if (!body || Object.keys(body).length === 0) details.push({ field: '', code: 'REQUIRED' });
  if (body?.enabled !== undefined && typeof body.enabled !== 'boolean')
    details.push({ field: 'enabled', code: 'INVALID' });
  if (
    body?.ssid !== undefined &&
    (typeof body.ssid !== 'string' || body.ssid.length < 1 || body.ssid.length > 32)
  ) {
    details.push({ field: 'ssid', code: 'TOO_LONG' });
  }
  if (
    body?.password !== undefined &&
    (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 63)
  ) {
    details.push({ field: 'password', code: 'TOO_SHORT' });
  }
  return details;
}

export const wifiNetworkMockHandlers = [
  http.get(apiPath('/mesh/v1/devices/:serialNumber/wifi-networks'), async ({ request, params }) => {
    await mockDelay();
    settleMockCommands();
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber);
    if (denied) return denied;
    const meta: ApiSchemas['ReadMeta'] = options.stale
      ? { source: 'CACHE', updatedAt: nowIso(-15 * 60_000), stale: true }
      : { source: 'LIVE', updatedAt: nowIso(), stale: false };
    return ok(stateFor(serialNumber).networks, { meta });
  }),

  http.post(
    apiPath('/mesh/v1/devices/:serialNumber/wifi-networks/:wifiIndex/reveal-password'),
    async ({ request, params }) => {
      await mockDelay();
      const serialNumber = String(params.serialNumber);
      const denied = checkDevice(request, serialNumber);
      if (denied) return denied;
      const now = Date.now();
      reveals = reveals.filter((time) => now - time < REVEAL_WINDOW_MS);
      if (options.revealRateLimited || reveals.length >= REVEAL_LIMIT)
        return apiError(429, 'RATE_LIMITED', { retryAfterSec: 600 });
      const state = stateFor(serialNumber);
      const wifiIndex = Number(params.wifiIndex);
      const network = state.networks.find((item) => item.wifiIndex === wifiIndex);
      if (!network) return apiError(404, 'NOT_FOUND');
      reveals.push(now);
      const body: { data: ApiSchemas['WifiPassword'] } = {
        data: {
          wifiIndex,
          ssid: network.ssid,
          password: state.passwords[wifiIndex] ?? '',
          securityMode: network.securityMode,
        },
      };
      return HttpResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
    },
  ),

  http.patch(
    apiPath('/mesh/v1/devices/:serialNumber/wifi-networks/:wifiIndex'),
    async ({ request, params }) => {
      await mockDelay();
      const serialNumber = String(params.serialNumber);
      const denied = checkDevice(request, serialNumber);
      if (denied) return denied;
      if (!request.headers.get('Content-Type')?.startsWith('application/merge-patch+json')) {
        return apiError(400, 'BAD_REQUEST', { message: 'Expected application/merge-patch+json' });
      }
      return idempotent(request, (raw) => {
        const body = raw as PatchBody | undefined;
        const details = validatePatch(body);
        if (details?.length) return apiError(400, 'VALIDATION_FAILED', { details });
        const state = stateFor(serialNumber);
        const wifiIndex = Number(params.wifiIndex);
        if (!state.networks.some((item) => item.wifiIndex === wifiIndex)) return apiError(404, 'NOT_FOUND');
        if (isMockDeviceBusy(serialNumber)) return apiError(409, 'DEVICE_BUSY', { retryAfterSec: 5 });

        const command = createMockCommand({
          type: 'WIFI_UPDATE',
          serialNumber,
          outcome: options.commandOutcome,
          errorCode: options.commandErrorCode,
          ...(options.commandSettleAfterMs !== null ? { settleAfterMs: options.commandSettleAfterMs } : {}),
          apply: () => {
            state.networks = state.networks.map((item) =>
              item.wifiIndex === wifiIndex
                ? {
                    ...item,
                    ...(typeof body?.enabled === 'boolean' ? { enabled: body.enabled } : {}),
                    ...(typeof body?.ssid === 'string' ? { ssid: body.ssid } : {}),
                  }
                : item,
            );
            if (typeof body?.password === 'string') state.passwords[wifiIndex] = body.password;
          },
        });
        const location = `/mesh/v1/commands/${command.commandId}`;
        return {
          response: ok(command, { status: 202, headers: { Location: location } }),
          replay: () =>
            ok(getMockCommand(command.commandId), { status: 202, headers: { Location: location } }),
        };
      });
    },
  ),
];

export function resetWifiNetworkMockDb(): void {
  states = new Map();
  reveals = [];
  options = { ...defaultOptions };
}
