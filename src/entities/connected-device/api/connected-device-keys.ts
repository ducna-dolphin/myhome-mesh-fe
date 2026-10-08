import { deviceScope } from '@/shared/lib';
import { normalizeMac, type ConnectedDeviceStatus } from '../model/connected-device-schema';

export const connectedDeviceKeys = {
  all: (serialNumber: string) => [...deviceScope(serialNumber), 'connected-devices'] as const,
  list: (serialNumber: string, status?: ConnectedDeviceStatus) =>
    [...deviceScope(serialNumber), 'connected-devices', 'list', status ?? 'ALL'] as const,
  detail: (serialNumber: string, macAddress: string) =>
    [...deviceScope(serialNumber), 'connected-devices', 'detail', normalizeMac(macAddress)] as const,
};
