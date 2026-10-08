import { contractScope } from '@/shared/lib';

export const contractKeys = {
  list: ['contract-links'] as const,
  detail: (contractId: string) => [...contractScope(contractId), 'detail'] as const,
};
