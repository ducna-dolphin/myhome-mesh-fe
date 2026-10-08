import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IdempotentVariables, WithMeta } from '@/shared/api';
import { deviceScope } from '@/shared/lib';
import type { OntDevice, RenameOntDeviceInput } from '../model/ont-device-schema';
import { ontDeviceApi } from './ont-device-api';

export const ontDeviceKeys = {
  detail: (serialNumber: string) => [...deviceScope(serialNumber), 'info'] as const,
};

export function useOntDeviceQuery(serialNumber: string | null) {
  return useQuery({
    queryKey: ontDeviceKeys.detail(serialNumber ?? ''),
    queryFn: ({ signal }) => ontDeviceApi.get(serialNumber!, signal),
    enabled: serialNumber !== null,
  });
}

export type RenameOntDeviceVariables = RenameOntDeviceInput & IdempotentVariables;

export function useRenameOntDeviceMutation(serialNumber: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey, ...input }: RenameOntDeviceVariables) =>
      ontDeviceApi.rename(serialNumber, input, idempotencyKey),
    onSuccess: (device) => {
      queryClient.setQueryData<WithMeta<OntDevice>>(ontDeviceKeys.detail(serialNumber), (current) =>
        current ? { ...current, data: device } : { data: device, meta: null, errors: [] },
      );
    },
  });
}

/** Returns the reboot Command; track it with `useCommandPoller(id, { type: 'REBOOT' })`. */
export function useRebootOntDeviceMutation(serialNumber: string) {
  return useMutation({
    mutationFn: ({ idempotencyKey }: IdempotentVariables) =>
      ontDeviceApi.reboot(serialNumber, idempotencyKey),
  });
}
