import { z } from 'zod';
import type { AcceptsContract, ApiSchemas } from '@/shared/api';

/** Internet contract linked to the caller (P1-01). */
export const contractLinkSchema = z.object({
  contractId: z.string().min(1),
  contractCode: z.string(),
  address: z.string().nullable().optional(),
  maskedPhone: z.string().optional(),
  selected: z.boolean(),
});

/** Contract card + data used by measurements (P1-02). */
export const contractLinkDetailSchema = contractLinkSchema.extend({
  lastPaymentDate: z.string().nullable().optional(),
  registrationDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  modelName: z.string().nullable().optional(),
  planDownloadMbps: z.number().nullable().optional(),
});

export const contractLinkListSchema = z.array(contractLinkSchema);

void (true satisfies AcceptsContract<typeof contractLinkSchema, ApiSchemas['ContractLink']>);
void (true satisfies AcceptsContract<typeof contractLinkDetailSchema, ApiSchemas['ContractLinkDetail']>);

export type ContractLink = z.infer<typeof contractLinkSchema>;
export type ContractLinkDetail = z.infer<typeof contractLinkDetailSchema>;

/** Partial-error targets of the detail endpoint (R-04: `payment`; `billing` kept until the contract settles). */
export const CONTRACT_PAYMENT_TARGETS = ['payment', 'billing'] as const;
