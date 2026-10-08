import { apiRequest, commandSchema, type Command, type WithMeta } from '@/shared/api';
import {
  connectedDeviceListSchema,
  connectedDeviceSchema,
  normalizeMac,
  type ConnectedDevice,
  type ConnectedDeviceStatus,
  type SelfDeviceIdentity,
  type UpdateConnectedDeviceInput,
} from '../model/connected-device-schema';

const enc = encodeURIComponent;
const listPath = (serialNumber: string) => `/mesh/v1/devices/${enc(serialNumber)}/connected-devices`;
const devicePath = (serialNumber: string, macAddress: string) =>
  `${listPath(serialNumber)}/${enc(normalizeMac(macAddress))}`;

export const connectedDeviceApi = {
  /** `GET …/connected-devices?status=` (P4-01). */
  async list(
    serialNumber: string,
    status?: ConnectedDeviceStatus,
    signal?: AbortSignal,
  ): Promise<WithMeta<ConnectedDevice[]>> {
    const { data, meta, errors } = await apiRequest({
      path: listPath(serialNumber),
      query: { status },
      schema: connectedDeviceListSchema,
      signal,
    });
    return { data, meta, errors };
  },

  /** `GET …/connected-devices/{macAddress}` (P4-01, TB-04). */
  async detail(
    serialNumber: string,
    macAddress: string,
    signal?: AbortSignal,
  ): Promise<WithMeta<ConnectedDevice>> {
    const { data, meta, errors } = await apiRequest({
      path: devicePath(serialNumber, macAddress),
      schema: connectedDeviceSchema,
      signal,
    });
    return { data, meta, errors };
  },

  /** `PATCH …/connected-devices/{macAddress}` — name/icon stored in MyHome (P4-03, TB-07). */
  async update(
    serialNumber: string,
    macAddress: string,
    input: UpdateConnectedDeviceInput,
    idempotencyKey: string,
  ): Promise<ConnectedDevice> {
    const { data } = await apiRequest({
      path: devicePath(serialNumber, macAddress),
      method: 'PATCH',
      schema: connectedDeviceSchema,
      body: input,
      idempotencyKey,
    });
    return data;
  },

  /** `POST …/block` → 202 Command, or 200 CONFIRMED when already blocked (P4-02). */
  async block(
    serialNumber: string,
    macAddress: string,
    self: SelfDeviceIdentity,
    idempotencyKey: string,
  ): Promise<Command> {
    const { data } = await apiRequest({
      path: `${devicePath(serialNumber, macAddress)}/block`,
      method: 'POST',
      schema: commandSchema,
      body: self,
      idempotencyKey,
    });
    return data;
  },

  /** `POST …/unblock` → 202 Command, or 200 CONFIRMED when not blocked (P4-02). */
  async unblock(serialNumber: string, macAddress: string, idempotencyKey: string): Promise<Command> {
    const { data } = await apiRequest({
      path: `${devicePath(serialNumber, macAddress)}/unblock`,
      method: 'POST',
      schema: commandSchema,
      idempotencyKey,
    });
    return data;
  },

  /**
   * `DELETE …/connected-devices/{macAddress}` with a JSON body → Command (P4-03, assumption Q-53:
   * block + hide). R-06: some gateways drop DELETE bodies; switch to `POST …/remove` if adopted.
   */
  async remove(
    serialNumber: string,
    macAddress: string,
    self: SelfDeviceIdentity,
    idempotencyKey: string,
  ): Promise<Command> {
    const { data } = await apiRequest({
      path: devicePath(serialNumber, macAddress),
      method: 'DELETE',
      schema: commandSchema,
      body: self,
      idempotencyKey,
    });
    return data;
  },
};
