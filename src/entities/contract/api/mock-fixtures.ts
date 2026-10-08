import type { ApiSchemas } from '@/shared/api';
import { MOCK_CONTRACTS, MOCK_PLAN_DOWNLOAD_MBPS, type MockScenario } from '@/shared/api/mock';

type ContractLinkDetailDto = ApiSchemas['ContractLinkDetail'];

const [first, second, third] = MOCK_CONTRACTS;

/** Fixtures typed with the generated contract: a schema change fails typecheck here. */
export const contractDetailFixtures: ContractLinkDetailDto[] = [
  {
    contractId: first.contractId,
    contractCode: first.contractCode,
    address: 'Số 12 ngõ 34 Láng Hạ, Đống Đa, Hà Nội',
    maskedPhone: '09xx***678',
    selected: true,
    lastPaymentDate: '2026-09-30',
    registrationDate: '2023-05-12',
    expiryDate: '2026-12-31',
    serialNumber: first.serialNumber,
    modelName: 'AX3000CV2',
    planDownloadMbps: MOCK_PLAN_DOWNLOAD_MBPS,
  },
  {
    contractId: second.contractId,
    contractCode: second.contractCode,
    address: 'Số 5 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội',
    maskedPhone: '09xx***678',
    selected: false,
    // Payment source failed: null + errors[] target `payment` (R-04).
    lastPaymentDate: null,
    registrationDate: '2024-02-01',
    expiryDate: null,
    serialNumber: second.serialNumber,
    modelName: 'iGate GW240-H',
    planDownloadMbps: MOCK_PLAN_DOWNLOAD_MBPS,
  },
  {
    contractId: third.contractId,
    contractCode: third.contractCode,
    address: null,
    maskedPhone: '09xx***678',
    selected: false,
    lastPaymentDate: '2026-08-15',
    registrationDate: '2025-07-20',
    expiryDate: '2027-07-20',
    serialNumber: third.serialNumber,
    modelName: 'AX3000CV2',
    planDownloadMbps: null,
  },
];

export function buildContractFixtures(
  scenario: Pick<MockScenario, 'contracts' | 'serial'>,
): ContractLinkDetailDto[] {
  const count = { none: 0, one: 1, many: 3 }[scenario.contracts];
  return contractDetailFixtures
    .slice(0, count)
    .map((contract) =>
      scenario.serial === 'missing' ? { ...contract, serialNumber: null, modelName: null } : { ...contract },
    );
}

export function toContractLink({
  contractId,
  contractCode,
  address,
  maskedPhone,
  selected,
}: ContractLinkDetailDto): ApiSchemas['ContractLink'] {
  return { contractId, contractCode, address, maskedPhone, selected };
}
