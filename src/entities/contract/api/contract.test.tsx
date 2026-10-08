import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setMockScenario, MOCK_CONTRACTS } from '@/shared/api/mock';
import { createQueryWrapper } from '@/shared/test';
import { contractLinkDetailSchema, contractLinkSchema } from '../model/contract-schema';
import { contractApi } from './contract-api';
import { contractKeys } from './contract-keys';
import { useSelectContractMutation, useSelectedContract } from './contract-queries';
import { contractDetailFixtures } from './mock-fixtures';
import { resetContractMockDb } from './mock-handlers';

function applyScenario(contracts: 'none' | 'one' | 'many', serial: 'present' | 'missing' = 'present') {
  setMockScenario({ contracts, serial });
  resetContractMockDb();
}

describe('contract schema', () => {
  it('parses every fixture', () => {
    for (const fixture of contractDetailFixtures) {
      expect(contractLinkDetailSchema.parse(fixture)).toMatchObject({ contractId: fixture.contractId });
      expect(contractLinkSchema.safeParse(fixture).success).toBe(true);
    }
  });

  it('accepts missing optional data as null', () => {
    expect(
      contractLinkDetailSchema.parse({
        contractId: 'c',
        contractCode: 'X',
        selected: true,
        serialNumber: null,
      }),
    ).toMatchObject({ serialNumber: null });
  });

  it('scopes keys by contract', () => {
    expect(contractKeys.detail('c1')).toEqual(['contract', 'c1', 'detail']);
    expect(contractKeys.list).toEqual(['contract-links']);
  });
});

describe('contract API (MSW)', () => {
  it('returns the list with meta and the detail with partial errors', async () => {
    applyScenario('many');
    const list = await contractApi.list();
    expect(list.data).toHaveLength(3);
    expect(list.meta?.source).toBe('LIVE');

    const detail = await contractApi.detail(MOCK_CONTRACTS[1].contractId);
    expect(detail.data.lastPaymentDate).toBeNull();
    expect(detail.errors).toEqual([{ code: 'UPSTREAM_UNAVAILABLE', target: 'payment' }]);
  });

  it('returns 404 for a contract that is not the caller’s (P0-03)', async () => {
    applyScenario('one');
    await expect(contractApi.detail(MOCK_CONTRACTS[2].contractId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('replays select with the same idempotency key and rejects a reused key with another body', async () => {
    applyScenario('many');
    const first = await contractApi.select(MOCK_CONTRACTS[1].contractId, 'key-1');
    const again = await contractApi.select(MOCK_CONTRACTS[1].contractId, 'key-1');
    expect(again).toEqual(first);
    await expect(contractApi.select(MOCK_CONTRACTS[2].contractId, 'key-1')).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
      status: 422,
    });
  });
});

describe('useSelectedContract', () => {
  it('resolves the selected contract and its serial number', async () => {
    applyScenario('one');
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useSelectedContract(), { wrapper });
    await waitFor(() => expect(result.current.serialNumber).toBe(MOCK_CONTRACTS[0].serialNumber));
    expect(result.current.status).toBe('ready');
    expect(result.current.contract?.contractCode).toBe('VNPT-HN-0123446');
    expect(result.current.detail?.planDownloadMbps).toBe(300);
  });

  it('reports none when the user has no Internet contract', async () => {
    applyScenario('none');
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useSelectedContract(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('none'));
    expect(result.current.serialNumber).toBeNull();
  });

  it('keeps serialNumber null when OneBSS returned no modem', async () => {
    applyScenario('one', 'missing');
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useSelectedContract(), { wrapper });
    await waitFor(() => expect(result.current.detail).not.toBeNull());
    expect(result.current.serialNumber).toBeNull();
  });

  it('switches the selected contract', async () => {
    applyScenario('many');
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => ({ selected: useSelectedContract(), select: useSelectContractMutation() }),
      {
        wrapper,
      },
    );
    await waitFor(() => expect(result.current.selected.status).toBe('ready'));
    await act(async () => {
      await result.current.select.mutateAsync({
        contractId: MOCK_CONTRACTS[2].contractId,
        idempotencyKey: 'k-switch',
      });
    });
    await waitFor(() => expect(result.current.selected.serialNumber).toBe(MOCK_CONTRACTS[2].serialNumber));
    expect(result.current.selected.contract?.contractCode).toBe('VNPT-HN-0789012');
  });
});
