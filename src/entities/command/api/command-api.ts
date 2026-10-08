import { apiRequest, commandListSchema, commandSchema, type Command } from '@/shared/api';

const enc = encodeURIComponent;

export const commandApi = {
  /** `GET /mesh/v1/commands/{commandId}` (P0-04). */
  async get(commandId: string, signal?: AbortSignal): Promise<Command> {
    const result = await apiRequest({
      path: `/mesh/v1/commands/${enc(commandId)}`,
      schema: commandSchema,
      signal,
    });
    return result.data;
  },
  /** `GET /mesh/v1/devices/{serialNumber}/commands?active=true` — resume tracking after reopening. */
  async listActive(serialNumber: string, signal?: AbortSignal): Promise<Command[]> {
    const result = await apiRequest({
      path: `/mesh/v1/devices/${enc(serialNumber)}/commands`,
      query: { active: true },
      schema: commandListSchema,
      signal,
    });
    return result.data;
  },
};
