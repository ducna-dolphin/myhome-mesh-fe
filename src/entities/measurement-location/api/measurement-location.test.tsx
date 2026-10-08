import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MOCK_CONTRACTS, setMockScenario } from '@/shared/api/mock';
import { createQueryWrapper } from '@/shared/test';
import {
  locationNameSchema,
  measurementLocationSchema,
  measurementSchema,
  shouldRecommendMesh,
  sortMeasurementLocations,
} from '../model/measurement-location-schema';
import { toMeasurementInput } from '../model/measurement-submission';
import { signalThresholdsSchema } from '../model/signal-thresholds';
import { measurementLocationApi } from './measurement-location-api';
import {
  measurementLocationKeys,
  useCreateMeasurementLocationMutation,
  useCreateMeasurementMutation,
  useDeleteMeasurementLocationMutation,
  useMeasurementLocationsQuery,
  useMeasurementsQuery,
  useRenameMeasurementLocationMutation,
  useSignalThresholdsQuery,
} from './measurement-location-queries';
import {
  buildMeasurementLocationFixtures,
  buildSignalThresholdsFixture,
  resetMeasurementLocationMockDb,
} from './mock-handlers';

const CONTRACT = MOCK_CONTRACTS[0].contractId;
const NOW = '2026-10-08T03:00:00.000Z';

function applySurvey(survey: 'empty' | 'partial' | 'full') {
  setMockScenario({ survey });
  resetMeasurementLocationMockDb();
}

describe('measurement-location model', () => {
  it.each(['empty', 'partial', 'full'] as const)('parses the %s survey fixtures', (survey) => {
    const { locations, measurements } = buildMeasurementLocationFixtures({ survey });
    for (const location of locations)
      expect(measurementLocationSchema.safeParse(location).success).toBe(true);
    for (const measurement of measurements)
      expect(measurementSchema.safeParse(measurement).success).toBe(true);
  });

  it('matches the XD survey: 1 WEAK, 2 FAIR, 2 GOOD', () => {
    const levels = buildMeasurementLocationFixtures({ survey: 'full' }).locations.map(
      (item) => item.latestLevel,
    );
    expect(levels.sort()).toEqual(['FAIR', 'FAIR', 'GOOD', 'GOOD', 'WEAK']);
  });

  it('parses both threshold fixtures (SPEED and RSSI mock methods)', () => {
    expect(
      signalThresholdsSchema.parse(buildSignalThresholdsFixture({ androidMethod: 'SPEED' })).androidMethod,
    ).toBe('SPEED');
    expect(
      signalThresholdsSchema.parse(buildSignalThresholdsFixture({ androidMethod: 'RSSI' })).androidMethod,
    ).toBe('RSSI');
    expect(
      signalThresholdsSchema.parse(buildSignalThresholdsFixture({ androidMethod: 'NONE' })).androidMethod,
    ).toBe('SPEED');
  });

  it('sorts WEAK → FAIR → GOOD → unmeasured and recommends Mesh on WEAK', () => {
    const sorted = sortMeasurementLocations([
      { locationId: '1', name: 'a', latestLevel: null, createdAt: '2026-01-01' },
      { locationId: '2', name: 'b', latestLevel: 'GOOD', createdAt: '2026-01-02' },
      { locationId: '3', name: 'c', latestLevel: 'WEAK', createdAt: '2026-01-03' },
      { locationId: '4', name: 'd', latestLevel: 'FAIR', createdAt: '2026-01-04' },
      { locationId: '5', name: 'e', latestLevel: 'FAIR', createdAt: '2026-01-01' },
    ]);
    expect(sorted.map((item) => item.locationId)).toEqual(['3', '5', '4', '2', '1']);
    expect(shouldRecommendMesh(sorted)).toBe(true);
    expect(shouldRecommendMesh(sorted.filter((item) => item.latestLevel !== 'WEAK'))).toBe(false);
  });

  it('validates location names (VT-02)', () => {
    expect(locationNameSchema.safeParse('Phòng ngủ 2').success).toBe(true);
    expect(locationNameSchema.safeParse('x'.repeat(31)).success).toBe(false);
    expect(locationNameSchema.safeParse('   ').success).toBe(false);
    expect(locationNameSchema.safeParse('<script>').success).toBe(false);
  });

  it('maps submissions to the current MeasurementInput and strips FE-only fields', () => {
    expect(
      toMeasurementInput({ method: 'SPEED', platform: 'ANDROID', downloadMbps: 180, latencyMs: 12 }, NOW),
    ).toEqual({
      platform: 'ANDROID',
      measuredAt: NOW,
      downloadMbps: 180,
      latencyMs: 12,
    });
    expect(
      toMeasurementInput(
        { method: 'RSSI', platform: 'ANDROID', source: 'BRIDGE', rssiDbm: -57.6, sampleCount: 8 },
        NOW,
      ),
    ).toEqual({ platform: 'ANDROID', measuredAt: NOW, rssiDbm: -58 });
    expect(
      toMeasurementInput({ method: 'RSSI', platform: 'IOS', source: 'MANUAL', rssiDbm: -65 }, NOW),
    ).toEqual({
      platform: 'IOS',
      measuredAt: NOW,
      rssiDbm: -65,
    });
  });

  it('scopes keys by contract', () => {
    expect(measurementLocationKeys.list('c1')).toEqual(['contract', 'c1', 'measurement-locations', 'list']);
    expect(measurementLocationKeys.measurements('c1', 'l1')).toEqual([
      'contract',
      'c1',
      'measurement-locations',
      'l1',
      'measurements',
    ]);
  });
});

describe('measurement-location API (MSW)', () => {
  it('lists the sorted grid', async () => {
    const locations = await measurementLocationApi.list(CONTRACT);
    expect(locations.map((item) => item.latestLevel)).toEqual(['WEAK', 'FAIR', 'FAIR', 'GOOD', 'GOOD']);
  });

  it('creates locations up to 20, then 409 LOCATION_LIMIT_REACHED', async () => {
    applySurvey('empty');
    for (let index = 1; index <= 20; index += 1) {
      await measurementLocationApi.create(CONTRACT, `Vị trí ${index}`, `create-${index}`);
    }
    await expect(measurementLocationApi.create(CONTRACT, 'Vị trí 21', 'create-21')).rejects.toMatchObject({
      code: 'LOCATION_LIMIT_REACHED',
      status: 409,
    });
  });

  it('rejects duplicate (case-insensitive) and too-long names with field details', async () => {
    await expect(measurementLocationApi.create(CONTRACT, 'phòng KHÁCH', 'dup')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'name', code: 'DUPLICATE' }],
    });
    await expect(measurementLocationApi.create(CONTRACT, 'x'.repeat(31), 'long')).rejects.toMatchObject({
      details: [{ field: 'name', code: 'TOO_LONG' }],
    });
  });

  it('replays a create with the same key instead of creating twice', async () => {
    applySurvey('empty');
    const first = await measurementLocationApi.create(CONTRACT, 'Gác mái', 'same-key');
    const second = await measurementLocationApi.create(CONTRACT, 'Gác mái', 'same-key');
    expect(second.locationId).toBe(first.locationId);
    expect(await measurementLocationApi.list(CONTRACT)).toHaveLength(1);
  });

  it('renames, lists history and deletes (then 404)', async () => {
    const [weak] = await measurementLocationApi.list(CONTRACT);
    await expect(measurementLocationApi.rename(weak!.locationId, 'Sân thượng', 'rn')).resolves.toMatchObject({
      name: 'Sân thượng',
    });
    const history = await measurementLocationApi.listMeasurements(weak!.locationId);
    expect(history.length).toBeGreaterThan(0);
    expect(history.length).toBeLessThanOrEqual(5);
    await measurementLocationApi.remove(weak!.locationId, 'del');
    await expect(measurementLocationApi.rename(weak!.locationId, 'X', 'rn2')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('saves SPEED and RSSI measurements and keeps the latest 5', async () => {
    const [location] = await measurementLocationApi.list(CONTRACT);
    const id = location!.locationId;
    const speed = await measurementLocationApi.createMeasurement(
      id,
      { method: 'SPEED', platform: 'ANDROID', downloadMbps: 250, latencyMs: 10 },
      NOW,
      'm1',
    );
    expect(speed.level).toBe('GOOD');
    const rssi = await measurementLocationApi.createMeasurement(
      id,
      { method: 'RSSI', platform: 'IOS', source: 'MANUAL', rssiDbm: -75 },
      NOW,
      'm2',
    );
    expect(rssi.level).toBe('WEAK');
    for (let index = 0; index < 5; index += 1) {
      await measurementLocationApi.createMeasurement(
        id,
        { method: 'RSSI', platform: 'ANDROID', source: 'BRIDGE', rssiDbm: -50, sampleCount: 8 },
        NOW,
        `more-${index}`,
      );
    }
    expect(await measurementLocationApi.listMeasurements(id)).toHaveLength(5);
  });

  it('answers 409 CONFLICT for SPEED when the plan speed is unknown (Q-48)', async () => {
    setMockScenario({ contracts: 'many' });
    resetMeasurementLocationMockDb();
    const [location] = await measurementLocationApi.list(MOCK_CONTRACTS[2].contractId);
    await expect(
      measurementLocationApi.createMeasurement(
        location!.locationId,
        { method: 'SPEED', platform: 'ANDROID', downloadMbps: 100, latencyMs: 10 },
        NOW,
        'conflict',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
  });

  it('rejects out-of-range RSSI', async () => {
    const [location] = await measurementLocationApi.list(CONTRACT);
    await expect(
      measurementLocationApi.createMeasurement(
        location!.locationId,
        { method: 'RSSI', platform: 'IOS', source: 'MANUAL', rssiDbm: -120 },
        NOW,
        'bad-rssi',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('returns 404 for another user’s contract', async () => {
    await expect(measurementLocationApi.list('not-mine')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns normalized thresholds', async () => {
    setMockScenario({ androidMethod: 'RSSI' });
    await expect(measurementLocationApi.getSignalThresholds()).resolves.toMatchObject({
      androidMethod: 'RSSI',
      rssi: { goodAboveDbm: -60, fairAboveDbm: -70 },
    });
  });
});

describe('measurement-location hooks', () => {
  it('runs the location lifecycle through mutations', async () => {
    applySurvey('partial');
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => ({
        list: useMeasurementLocationsQuery(CONTRACT),
        thresholds: useSignalThresholdsQuery(),
        create: useCreateMeasurementLocationMutation(CONTRACT),
        rename: useRenameMeasurementLocationMutation(CONTRACT),
        remove: useDeleteMeasurementLocationMutation(CONTRACT),
        measure: useCreateMeasurementMutation(CONTRACT),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(3));
    await waitFor(() => expect(result.current.thresholds.data?.androidMethod).toBe('SPEED'));

    let createdId = '';
    await act(async () => {
      createdId = (await result.current.create.mutateAsync({ name: 'Gác xép', idempotencyKey: 'h-create' }))
        .locationId;
    });
    await waitFor(() => expect(result.current.list.data).toHaveLength(4));

    await act(async () => {
      await result.current.rename.mutateAsync({
        locationId: createdId,
        name: 'Gác lửng',
        idempotencyKey: 'h-rename',
      });
    });
    expect(result.current.list.data?.find((item) => item.locationId === createdId)?.name).toBe('Gác lửng');

    await act(async () => {
      await result.current.measure.mutateAsync({
        locationId: createdId,
        submission: { method: 'RSSI', platform: 'IOS', source: 'MANUAL', rssiDbm: -66 },
        measuredAt: NOW,
        idempotencyKey: 'h-measure',
      });
    });
    await waitFor(() =>
      expect(result.current.list.data?.find((item) => item.locationId === createdId)?.latestLevel).toBe(
        'FAIR',
      ),
    );

    await act(async () => {
      await result.current.remove.mutateAsync({ locationId: createdId, idempotencyKey: 'h-delete' });
    });
    expect(result.current.list.data?.some((item) => item.locationId === createdId)).toBe(false);
  });

  it('loads the history of a location', async () => {
    const [location] = await measurementLocationApi.list(CONTRACT);
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMeasurementsQuery(CONTRACT, location!.locationId), { wrapper });
    await waitFor(() => expect(result.current.data?.length).toBeGreaterThan(0));
  });
});
