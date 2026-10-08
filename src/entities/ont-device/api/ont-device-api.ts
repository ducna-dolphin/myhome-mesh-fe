import { apiRequest, commandSchema, type Command, type WithMeta } from '@/shared/api';
import { ontDeviceSchema, type OntDevice, type RenameOntDeviceInput } from '../model/ont-device-schema';

const devicePath = (serialNumber: string) => `/mesh/v1/devices/${encodeURIComponent(serialNumber)}`;

export const ontDeviceApi = {
  /** `GET /mesh/v1/devices/{serialNumber}` (P5-01). */
  async get(serialNumber: string, signal?: AbortSignal): Promise<WithMeta<OntDevice>> {
    const { data, meta, errors } = await apiRequest({
      path: devicePath(serialNumber),
      schema: ontDeviceSchema,
      signal,
    });
    return { data, meta, errors };
  },

  /** `PATCH /mesh/v1/devices/{serialNumber}` — stored in MyHome only (P5-03). */
  async rename(
    serialNumber: string,
    input: RenameOntDeviceInput,
    idempotencyKey: string,
  ): Promise<OntDevice> {
    const { data } = await apiRequest({
      path: devicePath(serialNumber),
      method: 'PATCH',
      schema: ontDeviceSchema,
      body: input,
      idempotencyKey,
    });
    return data;
  },

  /** `POST /mesh/v1/devices/{serialNumber}/reboot` → 202 Command (P5-02). */
  async reboot(serialNumber: string, idempotencyKey: string): Promise<Command> {
    const { data } = await apiRequest({
      path: `${devicePath(serialNumber)}/reboot`,
      method: 'POST',
      schema: commandSchema,
      idempotencyKey,
    });
    return data;
  },
};
