import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IdempotentVariables, WithMeta } from '@/shared/api';
import type { ContractLink, ContractLinkDetail } from '../model/contract-schema';
import { contractApi } from './contract-api';
import { contractKeys } from './contract-keys';

export function useContractsQuery() {
  return useQuery({
    queryKey: contractKeys.list,
    queryFn: ({ signal }) => contractApi.list(signal),
    staleTime: 60_000,
  });
}

export function useContractDetailQuery(contractId: string | null) {
  return useQuery({
    queryKey: contractKeys.detail(contractId ?? ''),
    queryFn: ({ signal }) => contractApi.detail(contractId!, signal),
    enabled: contractId !== null,
    staleTime: 60_000,
  });
}

export interface SelectContractVariables extends IdempotentVariables {
  contractId: string;
}

export function useSelectContractMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, idempotencyKey }: SelectContractVariables) =>
      contractApi.select(contractId, idempotencyKey),
    onSuccess: (selected) => {
      queryClient.setQueryData<WithMeta<ContractLink[]>>(contractKeys.list, (current) =>
        current
          ? {
              ...current,
              data: current.data.map((item) => ({
                ...item,
                selected: item.contractId === selected.contractId,
              })),
            }
          : current,
      );
    },
  });
}

/**
 * - `unselected`: several contracts and none flagged `selected` — the user must pick one before
 *   the contract card and tabs load (LLD P1-01 "Chưa chọn thì … chưa tải các tab").
 */
export type SelectedContractStatus = 'loading' | 'error' | 'none' | 'unselected' | 'ready';

export interface SelectedContract {
  status: SelectedContractStatus;
  contracts: ContractLink[];
  contract: ContractLink | null;
  detail: ContractLinkDetail | null;
  /** ONT of the selected contract; `null` while loading or when OneBSS returned none. */
  serialNumber: string | null;
  listQuery: ReturnType<typeof useContractsQuery>;
  detailQuery: ReturnType<typeof useContractDetailQuery>;
}

/**
 * Data scope of every tab: selected contract → its ONT serial number (LLD §11.5).
 * `status: 'none'` means the user has no Internet contract (TC-02 → "Chưa có dịch vụ Internet").
 */
export function useSelectedContract(): SelectedContract {
  const listQuery = useContractsQuery();
  const contracts = listQuery.data?.data ?? [];
  // Backend keeps one selected contract per user. A single contract is implicitly selected;
  // with several and none flagged the user has to choose (status `unselected`).
  const contract = contracts.find((item) => item.selected) ?? (contracts.length === 1 ? contracts[0]! : null);
  const detailQuery = useContractDetailQuery(contract?.contractId ?? null);
  const detail = detailQuery.data?.data ?? null;

  let status: SelectedContractStatus = 'ready';
  if (listQuery.isPending) status = 'loading';
  else if (listQuery.isError) status = 'error';
  else if (contracts.length === 0) status = 'none';
  else if (!contract) status = 'unselected';

  return {
    status,
    contracts,
    contract,
    detail,
    serialNumber: detail?.serialNumber ?? null,
    listQuery,
    detailQuery,
  };
}
