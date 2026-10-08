import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { IdempotentVariables } from '@/shared/api';
import { deviceScope, useDeadline } from '@/shared/lib';
import {
  HEALTH_CHECK_POLL_LIMIT_MS,
  HEALTH_CHECK_POLL_MS,
  isTerminalHealthCheck,
  type HealthCheck,
} from '../model/health-check-schema';
import { healthCheckApi } from './health-check-api';

export const healthCheckKeys = {
  all: (serialNumber: string) => [...deviceScope(serialNumber), 'health-checks'] as const,
  latest: (serialNumber: string) => [...deviceScope(serialNumber), 'health-checks', 'latest'] as const,
  detail: (serialNumber: string, checkId: string) =>
    [...deviceScope(serialNumber), 'health-checks', 'detail', checkId] as const,
};

export function useLatestHealthCheckQuery(serialNumber: string | null) {
  return useQuery({
    queryKey: healthCheckKeys.latest(serialNumber ?? ''),
    queryFn: ({ signal }) => healthCheckApi.latest(serialNumber!, signal),
    enabled: serialNumber !== null,
  });
}

/** Starts (or reuses) a check; seed `useHealthCheckQuery` with the returned `check`. */
export function useCreateHealthCheckMutation(serialNumber: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey }: IdempotentVariables) =>
      healthCheckApi.create(serialNumber, idempotencyKey),
    onSuccess: ({ check }) => {
      queryClient.setQueryData(healthCheckKeys.detail(serialNumber, check.checkId), check);
      if (isTerminalHealthCheck(check)) queryClient.setQueryData(healthCheckKeys.latest(serialNumber), check);
    },
  });
}

export interface HealthCheckPollResult {
  check: HealthCheck | null;
  /** Running past 3 minutes: show it as failed (P6-01 proposal); polling stops. */
  isTimedOut: boolean;
  isPolling: boolean;
}

/**
 * Polls `GET …/health-checks/{checkId}` every 3s until DONE/FAILED, at most 3 minutes.
 * Polling stops when the component unmounts (leaving the tab).
 */
export function useHealthCheckQuery(
  serialNumber: string | null,
  checkId: string | null,
  options: { initialCheck?: HealthCheck | null } = {},
): HealthCheckPollResult {
  const queryClient = useQueryClient();
  const key = serialNumber && checkId ? `${serialNumber}/${checkId}` : null;
  const isTimedOut = useDeadline(key, HEALTH_CHECK_POLL_LIMIT_MS, key !== null);
  const seed = options.initialCheck?.checkId === checkId ? options.initialCheck : undefined;

  const query = useQuery({
    queryKey: healthCheckKeys.detail(serialNumber ?? '', checkId ?? ''),
    queryFn: ({ signal }) => healthCheckApi.get(serialNumber!, checkId!, signal),
    enabled: key !== null && !isTimedOut,
    initialData: seed ?? undefined,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (current) => {
      const data = current.state.data;
      return data && isTerminalHealthCheck(data) ? false : HEALTH_CHECK_POLL_MS;
    },
  });

  const check = query.data ?? null;
  const terminal = check ? isTerminalHealthCheck(check) : false;

  useEffect(() => {
    if (serialNumber && check && terminal)
      queryClient.setQueryData(healthCheckKeys.latest(serialNumber), check);
  }, [check, terminal, serialNumber, queryClient]);

  return {
    check,
    isTimedOut: isTimedOut && !terminal,
    isPolling: key !== null && !terminal && !isTimedOut,
  };
}

export type CreateFaultReportVariables = IdempotentVariables & { checkId: string | null };

export function useCreateFaultReportMutation(contractId: string) {
  return useMutation({
    mutationFn: ({ checkId, idempotencyKey }: CreateFaultReportVariables) =>
      healthCheckApi.createFaultReport(contractId, checkId, idempotencyKey),
  });
}
