import { http } from 'msw';
import type { ApiSchemas } from '@/shared/api';
import {
  apiError,
  apiPath,
  checkAuth,
  checkContract,
  getMockScenario,
  idempotent,
  mockDelay,
  nowIso,
  ok,
} from '@/shared/api/mock';
import { buildContractFixtures, toContractLink } from './mock-fixtures';

let contracts: ApiSchemas['ContractLinkDetail'][] = buildContractFixtures(getMockScenario());

const liveMeta = (): ApiSchemas['ReadMeta'] => ({ source: 'LIVE', updatedAt: nowIso(), stale: false });

export const contractMockHandlers = [
  http.get(apiPath('/link/v1/contract-links'), async ({ request }) => {
    await mockDelay();
    const unauthorized = checkAuth(request);
    if (unauthorized) return unauthorized;
    return ok(contracts.map(toContractLink), { meta: liveMeta() });
  }),

  http.get(apiPath('/link/v1/contract-links/:contractId'), async ({ request, params }) => {
    await mockDelay();
    const contractId = String(params.contractId);
    const denied = checkContract(request, contractId);
    if (denied) return denied;
    const contract = contracts.find((item) => item.contractId === contractId);
    if (!contract) return apiError(404, 'NOT_FOUND');
    const errors: ApiSchemas['PartialErrors'] =
      contract.lastPaymentDate === null ? [{ code: 'UPSTREAM_UNAVAILABLE', target: 'payment' }] : [];
    return ok(contract, { meta: liveMeta(), errors });
  }),

  http.post(apiPath('/link/v1/contract-links/:contractId/select'), async ({ request, params }) => {
    await mockDelay();
    const contractId = String(params.contractId);
    const denied = checkContract(request, contractId);
    if (denied) return denied;
    return idempotent(request, () => {
      contracts = contracts.map((item) => ({ ...item, selected: item.contractId === contractId }));
      const selected = contracts.find((item) => item.contractId === contractId)!;
      return ok(toContractLink(selected));
    });
  }),
];

export function resetContractMockDb(): void {
  contracts = buildContractFixtures(getMockScenario());
}
