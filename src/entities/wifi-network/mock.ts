// Mock-only public API: imported by src/app/mocks and tests, never by runtime code.
export {
  resetWifiNetworkMockDb,
  setWifiNetworkMockOptions,
  wifiNetworkFixtures,
  wifiNetworkMockHandlers,
} from './api/mock-handlers';
export type { WifiNetworkMockOptions } from './api/mock-handlers';
