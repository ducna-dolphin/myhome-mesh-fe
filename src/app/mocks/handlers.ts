import { commandMockHandlers, resetCommandMockDb } from '@/entities/command/mock';
import { connectedDeviceMockHandlers, resetConnectedDeviceMockDb } from '@/entities/connected-device/mock';
import { contractMockHandlers, resetContractMockDb } from '@/entities/contract/mock';
import { healthCheckMockHandlers, resetHealthCheckMockDb } from '@/entities/health-check/mock';
import {
  measurementLocationMockHandlers,
  resetMeasurementLocationMockDb,
} from '@/entities/measurement-location/mock';
import { ontDeviceMockHandlers, resetOntDeviceMockDb } from '@/entities/ont-device/mock';
import { resetWifiNetworkMockDb, wifiNetworkMockHandlers } from '@/entities/wifi-network/mock';
import { resetMockIdempotency } from '@/shared/api/mock';

/** Every MSW handler of the LLD API, aggregated from the entities that own them. */
export const handlers = [
  ...commandMockHandlers,
  ...contractMockHandlers,
  ...ontDeviceMockHandlers,
  ...wifiNetworkMockHandlers,
  ...connectedDeviceMockHandlers,
  ...measurementLocationMockHandlers,
  ...healthCheckMockHandlers,
];

/** Rebuilds every mock DB from the current scenario (`setMockScenario`) and clears idempotency/commands. */
export function resetMockDb(): void {
  resetMockIdempotency();
  resetCommandMockDb();
  resetContractMockDb();
  resetOntDeviceMockDb();
  resetWifiNetworkMockDb();
  resetConnectedDeviceMockDb();
  resetMeasurementLocationMockDb();
  resetHealthCheckMockDb();
}
