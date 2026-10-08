export {
  BYTES_PER_GB,
  bytesToGb,
  ONT_DEVICE_ERROR_TARGETS,
  ONT_DEVICE_FIELD_TARGETS,
  ontDeviceSchema,
  renameOntDeviceInputSchema,
} from './model/ont-device-schema';
export type { OntDevice, OntDeviceErrorTarget, RenameOntDeviceInput } from './model/ont-device-schema';
export { ontDeviceApi } from './api/ont-device-api';
export {
  ontDeviceKeys,
  useOntDeviceQuery,
  useRebootOntDeviceMutation,
  useRenameOntDeviceMutation,
} from './api/ont-device-queries';
export type { RenameOntDeviceVariables } from './api/ont-device-queries';
