import { env } from '@/shared/config/env';

/** Data scenario for the MSW mock (env flags; tests can switch with `setMockScenario`). */
export interface MockScenario {
  contracts: 'none' | 'one' | 'many';
  serial: 'present' | 'missing';
  survey: 'empty' | 'partial' | 'full';
  health: 'stable' | 'unstable' | 'down' | 'off' | 'fail' | 'hogged';
  device: 'online' | 'offline';
  androidMethod: 'SPEED' | 'RSSI' | 'NONE';
}

const fromEnv = (): MockScenario => ({
  contracts: env.VITE_MOCK_CONTRACTS,
  serial: env.VITE_MOCK_SERIAL,
  survey: env.VITE_MOCK_SURVEY,
  health: env.VITE_MOCK_HEALTH,
  device: env.VITE_MOCK_DEVICE,
  androidMethod: env.VITE_MOCK_ANDROID_METHOD,
});

let current: MockScenario = fromEnv();

export function getMockScenario(): Readonly<MockScenario> {
  return current;
}

/** Overrides scenario flags. Call `resetMockDb()` afterwards so fixtures are rebuilt. */
export function setMockScenario(patch: Partial<MockScenario>): void {
  current = { ...current, ...patch };
}

export function resetMockScenario(): void {
  current = fromEnv();
}

/** Shared mock identities so entities stay consistent without importing each other. */
export const MOCK_CONTRACTS = [
  { contractId: 'ctl-0123446', contractCode: 'VNPT-HN-0123446', serialNumber: 'VNPT2C3D4E5F' },
  { contractId: 'ctl-0456789', contractCode: 'VNPT-HN-0456789', serialNumber: 'VNPT9A8B7C6D' },
  { contractId: 'ctl-0789012', contractCode: 'VNPT-HN-0789012', serialNumber: 'VNPT11223344' },
] as const;

/** Plan speed of every mock contract (QD-02). */
export const MOCK_PLAN_DOWNLOAD_MBPS = 300;

/** Serial numbers owned by the mock user for the current scenario (others → 404, P0-03). */
export function mockOwnedSerials(): string[] {
  if (current.contracts === 'none') return [];
  const contracts = current.contracts === 'one' ? MOCK_CONTRACTS.slice(0, 1) : MOCK_CONTRACTS;
  return contracts.map((contract) => contract.serialNumber);
}

export function mockOwnedContractIds(): string[] {
  if (current.contracts === 'none') return [];
  const contracts = current.contracts === 'one' ? MOCK_CONTRACTS.slice(0, 1) : MOCK_CONTRACTS;
  return contracts.map((contract) => contract.contractId);
}
