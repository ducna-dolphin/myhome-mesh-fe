export {
  CONNECTED_DEVICE_ERROR_TARGETS,
  connectedDeviceKindSchema,
  connectedDeviceListSchema,
  connectedDeviceSchema,
  connectedDeviceStatusSchema,
  countConnectedDevices,
  deviceIconSchema,
  filterConnectedDevices,
  normalizeMac,
  updateConnectedDeviceInputSchema,
} from './model/connected-device-schema';
export type {
  ConnectedDevice,
  ConnectedDeviceFilter,
  ConnectedDeviceStatus,
  DeviceIcon as DeviceIconCode,
  SelfDeviceIdentity,
  UpdateConnectedDeviceInput,
} from './model/connected-device-schema';
export {
  CONNECTED_DEVICE_STATUS_ORDER,
  deviceFilterFromParam,
  deviceFilterParams,
  isSelfDevice,
  parseDeviceFilterParam,
  resolveDeviceIcon,
  sortConnectedDevices,
} from './model/connected-device-view';
export type { DeviceFilterParam, SortConnectedDevicesOptions } from './model/connected-device-view';
export { connectedDeviceApi } from './api/connected-device-api';
export {
  findCachedConnectedDevice,
  patchConnectedDeviceInCache,
  removeConnectedDeviceFromCache,
  writeConnectedDeviceToCache,
} from './api/connected-device-cache';
export {
  CONNECTED_DEVICES_POLL_MS,
  connectedDeviceKeys,
  useBlockConnectedDeviceMutation,
  useConnectedDeviceQuery,
  useConnectedDevicesQuery,
  useRemoveConnectedDeviceMutation,
  useUnblockConnectedDeviceMutation,
  useUpdateConnectedDeviceMutation,
} from './api/connected-device-queries';
export type {
  ConnectedDeviceCommandVariables,
  ConnectedDevicesQueryOptions,
  UpdateConnectedDeviceVariables,
} from './api/connected-device-queries';
export { selfDeviceIdentityKey, useSelfDeviceIdentity } from './api/use-self-device-identity';
export type { SelfDeviceIdentityResult } from './api/use-self-device-identity';
export { DeviceIcon } from './ui/device-icon';
export type { DeviceIconProps } from './ui/device-icon';
export { deviceIconGlyphs } from './ui/device-icon-glyphs';
export { DeviceStatusLabel } from './ui/device-status-label';
export type { DeviceStatusLabelProps } from './ui/device-status-label';
