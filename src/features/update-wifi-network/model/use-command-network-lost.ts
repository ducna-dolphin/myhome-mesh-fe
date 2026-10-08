import { hashKey, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { commandKeys } from '@/entities/command';
import { isApiError } from '@/shared/api';

/**
 * True once polling `commandId` failed without any HTTP response (phone dropped off the Wi-Fi it
 * just changed). After a 202 this means "sent, awaiting confirmation", not failure (LLD §7.3).
 */
export function useCommandNetworkLost(commandId: string | null): boolean {
  const queryClient = useQueryClient();
  const [lostFor, setLostFor] = useState<string | null>(null);

  useEffect(() => {
    if (commandId === null) return;
    const hash = hashKey(commandKeys.detail(commandId));
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.query.queryHash !== hash) return;
      const error: unknown = event.query.state.error;
      if (isApiError(error) && error.status === null) setLostFor(commandId);
    });
  }, [commandId, queryClient]);

  return commandId !== null && lostFor === commandId;
}
