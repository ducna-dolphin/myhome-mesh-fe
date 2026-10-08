import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IdempotentVariables } from '@/shared/api';
import { contractScope } from '@/shared/lib';
import type { MeasurementLocation } from '../model/measurement-location-schema';
import type { MeasurementSubmission } from '../model/measurement-submission';
import { measurementLocationApi } from './measurement-location-api';

export const measurementLocationKeys = {
  all: (contractId: string) => [...contractScope(contractId), 'measurement-locations'] as const,
  list: (contractId: string) => [...contractScope(contractId), 'measurement-locations', 'list'] as const,
  measurements: (contractId: string, locationId: string) =>
    [...contractScope(contractId), 'measurement-locations', locationId, 'measurements'] as const,
  thresholds: ['signal-thresholds'] as const,
};

export function useMeasurementLocationsQuery(contractId: string | null) {
  return useQuery({
    queryKey: measurementLocationKeys.list(contractId ?? ''),
    queryFn: ({ signal }) => measurementLocationApi.list(contractId!, signal),
    enabled: contractId !== null,
  });
}

export function useMeasurementsQuery(contractId: string | null, locationId: string | null) {
  return useQuery({
    queryKey: measurementLocationKeys.measurements(contractId ?? '', locationId ?? ''),
    queryFn: ({ signal }) => measurementLocationApi.listMeasurements(locationId!, signal),
    enabled: contractId !== null && locationId !== null,
  });
}

/** Thresholds kept for the whole session (LLD §6.4: "giữ ngưỡng trong bộ nhớ của phiên"). */
export function useSignalThresholdsQuery() {
  return useQuery({
    queryKey: measurementLocationKeys.thresholds,
    queryFn: ({ signal }) => measurementLocationApi.getSignalThresholds(signal),
    staleTime: Infinity,
  });
}

function useInvalidateLocations(contractId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: measurementLocationKeys.all(contractId) });
}

export type CreateMeasurementLocationVariables = IdempotentVariables & { name: string };

export function useCreateMeasurementLocationMutation(contractId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateLocations(contractId);
  return useMutation({
    mutationFn: ({ name, idempotencyKey }: CreateMeasurementLocationVariables) =>
      measurementLocationApi.create(contractId, name, idempotencyKey),
    onSuccess: (created) => {
      // Show the new tile right away (VT-04: unmeasured goes last); the refetch confirms the order.
      queryClient.setQueryData<MeasurementLocation[]>(measurementLocationKeys.list(contractId), (current) =>
        current && !current.some((item) => item.locationId === created.locationId)
          ? [...current, created]
          : current,
      );
      return invalidate();
    },
  });
}

interface ListSnapshot {
  previous: MeasurementLocation[] | undefined;
}

/** Optimistic list edit with rollback on error (P2-05). */
function useOptimisticListEdit(contractId: string) {
  const queryClient = useQueryClient();
  const listKey = measurementLocationKeys.list(contractId);
  return {
    async apply(update: (current: MeasurementLocation[]) => MeasurementLocation[]): Promise<ListSnapshot> {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<MeasurementLocation[]>(listKey);
      if (previous) queryClient.setQueryData<MeasurementLocation[]>(listKey, update(previous));
      return { previous };
    },
    rollback(snapshot: ListSnapshot | undefined) {
      if (snapshot?.previous) queryClient.setQueryData(listKey, snapshot.previous);
    },
    settle() {
      return queryClient.invalidateQueries({ queryKey: listKey });
    },
  };
}

export type RenameMeasurementLocationVariables = IdempotentVariables & { locationId: string; name: string };

/** Rename keeps the history (VT-06); the tile shows the new name before the server answers. */
export function useRenameMeasurementLocationMutation(contractId: string) {
  const queryClient = useQueryClient();
  const optimistic = useOptimisticListEdit(contractId);
  return useMutation({
    mutationFn: ({ locationId, name, idempotencyKey }: RenameMeasurementLocationVariables) =>
      measurementLocationApi.rename(locationId, name, idempotencyKey),
    onMutate: ({ locationId, name }) =>
      optimistic.apply((current) =>
        current.map((item) => (item.locationId === locationId ? { ...item, name: name.trim() } : item)),
      ),
    onError: (_error, _variables, snapshot) => optimistic.rollback(snapshot),
    onSuccess: (renamed) => {
      queryClient.setQueryData<MeasurementLocation[]>(measurementLocationKeys.list(contractId), (current) =>
        current?.map((item) => (item.locationId === renamed.locationId ? { ...item, ...renamed } : item)),
      );
    },
    onSettled: () => optimistic.settle(),
  });
}

export type DeleteMeasurementLocationVariables = IdempotentVariables & { locationId: string };

/** Delete also removes the history and frees one of the 20 slots (VT-01, VT-06). */
export function useDeleteMeasurementLocationMutation(contractId: string) {
  const queryClient = useQueryClient();
  const optimistic = useOptimisticListEdit(contractId);
  return useMutation({
    mutationFn: ({ locationId, idempotencyKey }: DeleteMeasurementLocationVariables) =>
      measurementLocationApi.remove(locationId, idempotencyKey),
    onMutate: ({ locationId }) =>
      optimistic.apply((current) => current.filter((item) => item.locationId !== locationId)),
    onError: (_error, _variables, snapshot) => optimistic.rollback(snapshot),
    onSuccess: (_result, { locationId }) => {
      queryClient.removeQueries({ queryKey: measurementLocationKeys.measurements(contractId, locationId) });
    },
    onSettled: () => optimistic.settle(),
  });
}

export type CreateMeasurementVariables = IdempotentVariables & {
  locationId: string;
  submission: MeasurementSubmission;
  /** Original measurement time (ISO); keep it when resending after a network error (LS-02). */
  measuredAt: string;
};

export function useCreateMeasurementMutation(contractId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateLocations(contractId);
  return useMutation({
    mutationFn: ({ locationId, submission, measuredAt, idempotencyKey }: CreateMeasurementVariables) =>
      measurementLocationApi.createMeasurement(locationId, submission, measuredAt, idempotencyKey),
    onSuccess: (measurement, { locationId }) => {
      // VT-05: the tile shows the latest result immediately.
      queryClient.setQueryData<MeasurementLocation[]>(measurementLocationKeys.list(contractId), (current) =>
        current?.map((item) =>
          item.locationId === locationId
            ? { ...item, latestLevel: measurement.level, latestMeasuredAt: measurement.measuredAt }
            : item,
        ),
      );
      return invalidate();
    },
  });
}
