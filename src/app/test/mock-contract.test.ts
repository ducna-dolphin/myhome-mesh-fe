import { describe, expect, it } from 'vitest';
import { commandApi } from '@/entities/command';
import { connectedDeviceApi, connectedDeviceListSchema } from '@/entities/connected-device';
import { connectedDeviceFixtures } from '@/entities/connected-device/mock';
import { contractApi, contractLinkDetailSchema } from '@/entities/contract';
import { contractDetailFixtures } from '@/entities/contract/mock';
import { healthCheckApi, healthCheckItemSchema } from '@/entities/health-check';
import { healthCheckItemFixtures } from '@/entities/health-check/mock';
import {
  measurementLocationApi,
  measurementLocationListSchema,
  measurementListSchema,
  signalThresholdsSchema,
} from '@/entities/measurement-location';
import {
  buildMeasurementLocationFixtures,
  buildSignalThresholdsFixture,
} from '@/entities/measurement-location/mock';
import { ontDeviceApi, ontDeviceSchema } from '@/entities/ont-device';
import { ontDeviceFixtures } from '@/entities/ont-device/mock';
import { wifiNetworkApi, wifiNetworkListSchema } from '@/entities/wifi-network';
import { wifiNetworkFixtures } from '@/entities/wifi-network/mock';
import { MOCK_CONTRACTS, setMockScenario, type MockScenario } from '@/shared/api/mock';
import { resetMockDb } from '@/app/mocks';

/**
 * Contract test for the MSW mock: fixtures are typed with the generated OpenAPI types
 * (drift → typecheck error) and must also pass the runtime Zod schemas used by the app.
 */
describe('MSW fixtures vs Zod schemas', () => {
  it('parses every static fixture', () => {
    expect(contractDetailFixtures.every((item) => contractLinkDetailSchema.safeParse(item).success)).toBe(
      true,
    );
    expect(ontDeviceFixtures.every((item) => ontDeviceSchema.safeParse(item).success)).toBe(true);
    expect(wifiNetworkListSchema.safeParse(wifiNetworkFixtures).success).toBe(true);
    expect(connectedDeviceListSchema.safeParse(connectedDeviceFixtures).success).toBe(true);
    for (const items of Object.values(healthCheckItemFixtures)) {
      expect(items.every((item) => healthCheckItemSchema.safeParse(item).success)).toBe(true);
    }
    for (const survey of ['empty', 'partial', 'full'] as const) {
      const { locations, measurements } = buildMeasurementLocationFixtures({ survey });
      expect(measurementLocationListSchema.safeParse(locations).success).toBe(true);
      expect(measurementListSchema.safeParse(measurements).success).toBe(true);
    }
    for (const androidMethod of ['SPEED', 'RSSI', 'NONE'] as const) {
      expect(signalThresholdsSchema.safeParse(buildSignalThresholdsFixture({ androidMethod })).success).toBe(
        true,
      );
    }
  });
});

const scenarios: Array<Partial<MockScenario>> = [
  { contracts: 'one', survey: 'full', health: 'stable' },
  { contracts: 'many', survey: 'partial', health: 'unstable', androidMethod: 'RSSI' },
  { contracts: 'one', survey: 'empty', health: 'down', serial: 'missing' },
];

describe.each(scenarios)('MSW endpoints parse through the entity APIs (%o)', (scenario) => {
  it('serves every read endpoint in the envelope expected by the app', async () => {
    setMockScenario(scenario);
    resetMockDb();

    const contracts = await contractApi.list();
    expect(contracts.data.length).toBeGreaterThan(0);
    for (const contract of contracts.data) {
      const detail = await contractApi.detail(contract.contractId);
      expect(detail.data.serialNumber ?? null).toEqual(
        scenario.serial === 'missing' ? null : expect.any(String),
      );
      await measurementLocationApi.list(contract.contractId);
    }

    const serial = MOCK_CONTRACTS[0].serialNumber;
    await ontDeviceApi.get(serial);
    await wifiNetworkApi.list(serial);
    await connectedDeviceApi.list(serial);
    await commandApi.listActive(serial);
    await measurementLocationApi.getSignalThresholds();
    const latest = await healthCheckApi.latest(serial);
    expect(latest).not.toBeNull();
    const created = await healthCheckApi.create(serial, `contract-${scenario.health}`);
    await healthCheckApi.get(serial, created.check.checkId);
  });
});

describe('MSW scenario flags', () => {
  it.each([
    ['off', 'WIFI_SIGNAL', 'OFF', 'ENABLE_WIFI'],
    ['fail', 'WIFI_SIGNAL', 'FAIL', 'ORDER_MESH'],
    ['hogged', 'CONNECTED_DEVICES', 'HOGGED', 'OPEN_DEVICES_TAB'],
  ] as const)('VITE_MOCK_HEALTH=%s finishes with one issue', (health, itemType, status, action) => {
    setMockScenario({ health });
    resetMockDb();
    const items = healthCheckItemFixtures[health];
    expect(items.find((item) => item.itemType === itemType)).toMatchObject({ status, action });
    expect(
      items.filter((item) => item.status !== 'STABLE' && item.status !== 'PASS' && item.status !== 'NORMAL'),
    ).toHaveLength(1);
  });

  it('serves no contracts for VITE_MOCK_CONTRACTS=none', async () => {
    setMockScenario({ contracts: 'none' });
    resetMockDb();
    await expect(contractApi.list()).resolves.toMatchObject({ data: [] });
    await expect(ontDeviceApi.get(MOCK_CONTRACTS[0].serialNumber)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('serves 409 DEVICE_OFFLINE for device reads when VITE_MOCK_DEVICE=offline', async () => {
    setMockScenario({ device: 'offline' });
    await expect(wifiNetworkApi.list(MOCK_CONTRACTS[0].serialNumber)).rejects.toMatchObject({
      code: 'DEVICE_OFFLINE',
    });
    await expect(connectedDeviceApi.list(MOCK_CONTRACTS[0].serialNumber)).rejects.toMatchObject({
      code: 'DEVICE_OFFLINE',
    });
  });

  it('requires an Idempotency-Key on writes', async () => {
    await expect(contractApi.select(MOCK_CONTRACTS[0].contractId, '')).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      status: 400,
    });
  });
});
