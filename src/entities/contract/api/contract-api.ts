import { apiRequest, type WithMeta } from '@/shared/api';
import {
  contractLinkDetailSchema,
  contractLinkListSchema,
  contractLinkSchema,
  type ContractLink,
  type ContractLinkDetail,
} from '../model/contract-schema';

const enc = encodeURIComponent;

export const contractApi = {
  /** `GET /link/v1/contract-links` — `[]` means "no Internet service" (TC-02). */
  async list(signal?: AbortSignal): Promise<WithMeta<ContractLink[]>> {
    const { data, meta, errors } = await apiRequest({
      path: '/link/v1/contract-links',
      schema: contractLinkListSchema,
      signal,
    });
    return { data, meta, errors };
  },

  /** `GET /link/v1/contract-links/{contractId}` (P1-02). */
  async detail(contractId: string, signal?: AbortSignal): Promise<WithMeta<ContractLinkDetail>> {
    const { data, meta, errors } = await apiRequest({
      path: `/link/v1/contract-links/${enc(contractId)}`,
      schema: contractLinkDetailSchema,
      signal,
    });
    return { data, meta, errors };
  },

  /** `POST /link/v1/contract-links/{contractId}/select` (P1-02). */
  async select(contractId: string, idempotencyKey: string): Promise<ContractLink> {
    const { data } = await apiRequest({
      path: `/link/v1/contract-links/${enc(contractId)}/select`,
      method: 'POST',
      schema: contractLinkSchema,
      idempotencyKey,
    });
    return data;
  },
};
