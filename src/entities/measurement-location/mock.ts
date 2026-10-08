// Mock-only public API: imported by src/app/mocks and tests, never by runtime code.
export {
  buildMeasurementLocationFixtures,
  buildSignalThresholdsFixture,
  measurementLocationMockHandlers,
  resetMeasurementLocationMockDb,
} from './api/mock-handlers';
export type { SignalThresholdsMockDto } from './api/mock-handlers';
