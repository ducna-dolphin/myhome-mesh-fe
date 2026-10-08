import { useCallback } from 'react';
import { useSelectedContract } from '@/entities/contract';
import { miniAppTokens } from '@/shared/api';
import { useSuperApp } from '@/shared/super-app';

/**
 * Selected contract + the retry of the contract lookup. Per LLD P1-01 the phone number is only
 * read when the host issues a MiniApp token, so retry asks for a new token first (which re-runs
 * the OneBSS lookup) through the shared token manager — the refetch then sends that new token —
 * and refetches the list; without that bridge call it just refetches.
 */
export function useContractGate() {
  const selected = useSelectedContract();
  const superApp = useSuperApp();
  const { refetch } = selected.listQuery;

  const retry = useCallback(async () => {
    if (superApp.supports('getMiniAppToken')) {
      try {
        await miniAppTokens.refresh();
      } catch {
        // Fall back to a plain refetch.
      }
    }
    await refetch();
  }, [refetch, superApp]);

  return { selected, retry };
}
