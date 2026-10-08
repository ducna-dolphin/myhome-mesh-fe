import { http } from 'msw';
import type { ApiSchemas } from '@/shared/api';
import {
  apiError,
  apiPath,
  checkAuth,
  checkContract,
  getMockScenario,
  idempotent,
  MOCK_CONTRACTS,
  MOCK_PLAN_DOWNLOAD_MBPS,
  mockDelay,
  mockOwnedContractIds,
  ok,
  type MockScenario,
} from '@/shared/api/mock';
import { createUuid } from '@/shared/lib';
import { classifyRssiLevel, classifySpeedLevel } from '../lib/classify-level';
import {
  locationNameSchema,
  MAX_MEASUREMENT_LOCATIONS,
  sortMeasurementLocations,
} from '../model/measurement-location-schema';
import { RSSI_MAX_DBM, RSSI_MIN_DBM } from '../model/measurement-submission';
import { signalThresholdsSchema } from '../model/signal-thresholds';

type LocationDto = ApiSchemas['MeasurementLocation'];
type MeasurementDto = ApiSchemas['Measurement'];
type SignalLevelDto = ApiSchemas['SignalLevel'];

/**
 * Current contract shape, plus the proposed `androidMethod` (openapi-review §3) so the mock can
 * drive both Android flows via `VITE_MOCK_ANDROID_METHOD`.
 */
export type SignalThresholdsMockDto = ApiSchemas['SignalThresholds'] & { androidMethod?: 'SPEED' | 'RSSI' };

export function buildSignalThresholdsFixture(
  scenario: Pick<MockScenario, 'androidMethod'>,
): SignalThresholdsMockDto {
  return {
    androidMethod: scenario.androidMethod === 'RSSI' ? 'RSSI' : 'SPEED',
    android: { goodMinPercent: 70, fairMinPercent: 40, latencyDowngradeMs: 50 },
    ios: { goodAboveDbm: -60, fairAboveDbm: -70 },
  };
}

interface LocationSeed {
  name: string;
  history: SignalLevelDto[];
}

/** XD "Mesh - Wifi": full = 5 locations (1 WEAK, 2 FAIR, 2 GOOD); history newest first. */
const surveySeeds: Record<MockScenario['survey'], LocationSeed[]> = {
  empty: [],
  partial: [
    { name: 'Phòng khách', history: ['GOOD', 'FAIR'] },
    { name: 'Phòng bếp', history: ['FAIR'] },
    { name: 'Phòng ngủ', history: [] },
  ],
  full: [
    { name: 'Phòng khách', history: ['GOOD', 'GOOD', 'FAIR'] },
    { name: 'Phòng ngủ', history: ['FAIR', 'WEAK'] },
    { name: 'Phòng bếp', history: ['FAIR'] },
    { name: 'Ban công', history: ['WEAK', 'WEAK', 'FAIR'] },
    { name: 'Phòng làm việc', history: ['GOOD'] },
  ],
};

interface LocationRecord {
  contractId: string;
  location: LocationDto;
  measurements: MeasurementDto[];
  deleted: boolean;
}

const HOUR = 3_600_000;
let records: LocationRecord[] = [];

function seedFor(contractId: string, survey: MockScenario['survey'], baseTime: number): LocationRecord[] {
  return surveySeeds[survey].map((seed, index) => {
    const createdAt = new Date(baseTime - (30 - index) * 24 * HOUR).toISOString();
    const measurements: MeasurementDto[] = seed.history.map((level, step) => ({
      measurementId: createUuid(),
      level,
      measuredAt: new Date(baseTime - (index + 1) * HOUR - step * 24 * HOUR).toISOString(),
    }));
    return {
      contractId,
      location: {
        locationId: createUuid(),
        name: seed.name,
        latestLevel: measurements[0]?.level ?? null,
        latestMeasuredAt: measurements[0]?.measuredAt ?? null,
        createdAt,
      },
      measurements,
      deleted: false,
    };
  });
}

/** Builds typed fixtures for a scenario; exported for the contract test. */
export function buildMeasurementLocationFixtures(scenario: Pick<MockScenario, 'survey'>): {
  locations: LocationDto[];
  measurements: MeasurementDto[];
} {
  const seeded = seedFor(MOCK_CONTRACTS[0].contractId, scenario.survey, Date.now());
  return {
    locations: seeded.map((record) => record.location),
    measurements: seeded.flatMap((r) => r.measurements),
  };
}

function reset(): void {
  const scenario = getMockScenario();
  const now = Date.now();
  records = mockOwnedContractIds().flatMap((contractId) => seedFor(contractId, scenario.survey, now));
}
reset();

const activeFor = (contractId: string) =>
  records.filter((record) => record.contractId === contractId && !record.deleted);
const findActive = (locationId: string) =>
  records.find((record) => record.location.locationId === locationId && !record.deleted);
const planFor = (contractId: string) =>
  contractId === MOCK_CONTRACTS[2].contractId ? null : MOCK_PLAN_DOWNLOAD_MBPS;

function validateName(name: unknown, contractId: string, exceptId?: string): Response | null {
  if (typeof name !== 'string')
    return apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'name', code: 'REQUIRED' }] });
  const trimmed = name.trim();
  if (trimmed.length > 30)
    return apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'name', code: 'TOO_LONG' }] });
  if (!locationNameSchema.safeParse(trimmed).success) {
    return apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'name', code: 'INVALID_CHARACTERS' }] });
  }
  const duplicate = activeFor(contractId).some(
    (record) =>
      record.location.locationId !== exceptId && record.location.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return duplicate
    ? apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'name', code: 'DUPLICATE' }] })
    : null;
}

interface MeasurementBody {
  platform?: unknown;
  measuredAt?: unknown;
  downloadMbps?: unknown;
  latencyMs?: unknown;
  rssiDbm?: unknown;
}

function levelFor(body: MeasurementBody, contractId: string): SignalLevelDto | Response {
  const thresholds = signalThresholdsSchema.parse(buildSignalThresholdsFixture(getMockScenario()));
  if (body.platform !== 'ANDROID' && body.platform !== 'IOS') {
    return apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'platform', code: 'REQUIRED' }] });
  }
  if (typeof body.measuredAt !== 'string') {
    return apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'measuredAt', code: 'REQUIRED' }] });
  }
  if (typeof body.rssiDbm === 'number') {
    // RSSI: iPhone (contract) or Android method B (proposed extension, accepted by the mock).
    if (!Number.isInteger(body.rssiDbm) || body.rssiDbm < RSSI_MIN_DBM || body.rssiDbm > RSSI_MAX_DBM) {
      return apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'rssiDbm', code: 'OUT_OF_RANGE' }] });
    }
    return classifyRssiLevel(body.rssiDbm, thresholds.rssi);
  }
  if (body.platform === 'IOS') {
    return apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'rssiDbm', code: 'REQUIRED' }] });
  }
  if (typeof body.downloadMbps !== 'number' || typeof body.latencyMs !== 'number') {
    return apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'downloadMbps', code: 'REQUIRED' }] });
  }
  const plan = planFor(contractId);
  // Q-48: plan speed unknown → 409 CONFLICT for speed-based measurements.
  if (plan === null) return apiError(409, 'CONFLICT', { message: 'Plan download speed unknown' });
  return classifySpeedLevel(
    { downloadMbps: body.downloadMbps, latencyMs: body.latencyMs },
    plan,
    thresholds.speed,
  );
}

export const measurementLocationMockHandlers = [
  http.get(apiPath('/mesh/v1/signal-thresholds'), async ({ request }) => {
    await mockDelay(150);
    const unauthorized = checkAuth(request);
    if (unauthorized) return unauthorized;
    return ok(buildSignalThresholdsFixture(getMockScenario()));
  }),

  http.get(apiPath('/mesh/v1/measurement-locations'), async ({ request }) => {
    await mockDelay();
    const contractId = new URL(request.url).searchParams.get('contractId');
    if (!contractId) {
      return (
        checkAuth(request) ??
        apiError(400, 'VALIDATION_FAILED', { details: [{ field: 'contractId', code: 'REQUIRED' }] })
      );
    }
    const denied = checkContract(request, contractId);
    if (denied) return denied;
    return ok(
      sortMeasurementLocations(activeFor(contractId).map((record) => record.location)) as LocationDto[],
    );
  }),

  http.post(apiPath('/mesh/v1/measurement-locations'), async ({ request }) => {
    await mockDelay();
    const unauthorized = checkAuth(request);
    if (unauthorized) return unauthorized;
    return idempotent(request, (raw) => {
      const body = (raw ?? {}) as { contractId?: unknown; name?: unknown };
      const contractId = typeof body.contractId === 'string' ? body.contractId : '';
      const denied = checkContract(request, contractId);
      if (denied) return denied;
      if (activeFor(contractId).length >= MAX_MEASUREMENT_LOCATIONS)
        return apiError(409, 'LOCATION_LIMIT_REACHED');
      const invalid = validateName(body.name, contractId);
      if (invalid) return invalid;
      const location: LocationDto = {
        locationId: createUuid(),
        name: String(body.name).trim(),
        latestLevel: null,
        latestMeasuredAt: null,
        createdAt: new Date().toISOString(),
      };
      records.push({ contractId, location, measurements: [], deleted: false });
      return ok(location, {
        status: 201,
        headers: { Location: `/mesh/v1/measurement-locations/${location.locationId}` },
      });
    });
  }),

  http.patch(apiPath('/mesh/v1/measurement-locations/:locationId'), async ({ request, params }) => {
    await mockDelay();
    const unauthorized = checkAuth(request);
    if (unauthorized) return unauthorized;
    return idempotent(request, (raw) => {
      const record = findActive(String(params.locationId));
      if (!record) return apiError(404, 'NOT_FOUND');
      const name = (raw as { name?: unknown } | undefined)?.name;
      const invalid = validateName(name, record.contractId, record.location.locationId);
      if (invalid) return invalid;
      record.location = { ...record.location, name: String(name).trim() };
      return ok(record.location);
    });
  }),

  http.delete(apiPath('/mesh/v1/measurement-locations/:locationId'), async ({ request, params }) => {
    await mockDelay();
    const unauthorized = checkAuth(request);
    if (unauthorized) return unauthorized;
    return idempotent(request, () => {
      const record = findActive(String(params.locationId));
      if (!record) return apiError(404, 'NOT_FOUND');
      record.deleted = true;
      return ok({ locationId: record.location.locationId });
    });
  }),

  http.get(
    apiPath('/mesh/v1/measurement-locations/:locationId/measurements'),
    async ({ request, params }) => {
      await mockDelay();
      const unauthorized = checkAuth(request);
      if (unauthorized) return unauthorized;
      const record = findActive(String(params.locationId));
      return record ? ok(record.measurements.slice(0, 5)) : apiError(404, 'NOT_FOUND');
    },
  ),

  http.post(
    apiPath('/mesh/v1/measurement-locations/:locationId/measurements'),
    async ({ request, params }) => {
      await mockDelay();
      const unauthorized = checkAuth(request);
      if (unauthorized) return unauthorized;
      return idempotent(request, (raw) => {
        const record = findActive(String(params.locationId));
        if (!record) return apiError(404, 'NOT_FOUND');
        const body = (raw ?? {}) as MeasurementBody;
        const level = levelFor(body, record.contractId);
        if (level instanceof Response) return level;
        const measurement: MeasurementDto = {
          measurementId: createUuid(),
          level,
          measuredAt: String(body.measuredAt),
        };
        record.measurements = [measurement, ...record.measurements].slice(0, 5);
        record.location = {
          ...record.location,
          latestLevel: level,
          latestMeasuredAt: measurement.measuredAt,
        };
        return ok(measurement, {
          status: 201,
          headers: {
            Location: `/mesh/v1/measurement-locations/${record.location.locationId}/measurements/${measurement.measurementId}`,
          },
        });
      });
    },
  ),
];

export function resetMeasurementLocationMockDb(): void {
  reset();
}
