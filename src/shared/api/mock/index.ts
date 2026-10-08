// MSW building blocks shared by every entity's `api/mock-handlers.ts`.
export { apiError, apiPath, mockDelay, nowIso, ok } from './mock-http';
export type { Schemas } from './mock-http';
export {
  getMockScenario,
  MOCK_CONTRACTS,
  MOCK_PLAN_DOWNLOAD_MBPS,
  mockOwnedContractIds,
  mockOwnedSerials,
  resetMockScenario,
  setMockScenario,
} from './mock-scenario';
export type { MockScenario } from './mock-scenario';
export {
  countMockReboots,
  createMockCommand,
  getMockCommand,
  isMockDeviceBusy,
  lastMockRebootAt,
  listActiveMockCommands,
  MOCK_COMMAND_SETTLE_MS,
  resetMockCommands,
  settleMockCommands,
} from './mock-command-store';
export type { CreateMockCommandInput, MockCommandOutcome } from './mock-command-store';
export { idempotent, resetMockIdempotency } from './mock-idempotency';
export { checkAuth, checkContract, checkDevice } from './mock-guards';
