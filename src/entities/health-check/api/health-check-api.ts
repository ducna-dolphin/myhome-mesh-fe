import { apiRequest } from '@/shared/api';
import {
  faultReportSchema,
  healthCheckListSchema,
  healthCheckSchema,
  type FaultReport,
  type HealthCheck,
} from '../model/health-check-schema';

const enc = encodeURIComponent;
const checksPath = (serialNumber: string) => `/mesh/v1/devices/${enc(serialNumber)}/health-checks`;

export interface CreateHealthCheckResult {
  /** 200: latest run is still fresh (< 30 min, CL-03); 202: new or running check. */
  status: 200 | 202;
  check: HealthCheck;
  location: string | null;
}

export const healthCheckApi = {
  /** `GET …/health-checks?limit=1&sort=-createdAt` → latest run or `null` (CL-03, CL-04). */
  async latest(serialNumber: string, signal?: AbortSignal): Promise<HealthCheck | null> {
    const { data } = await apiRequest({
      path: checksPath(serialNumber),
      query: { limit: 1, sort: '-createdAt' },
      schema: healthCheckListSchema,
      signal,
    });
    return data[0] ?? null;
  },

  /** `POST …/health-checks` — call each time the Quality tab opens. */
  async create(serialNumber: string, idempotencyKey: string): Promise<CreateHealthCheckResult> {
    const result = await apiRequest({
      path: checksPath(serialNumber),
      method: 'POST',
      schema: healthCheckSchema,
      idempotencyKey,
    });
    return { status: result.status === 200 ? 200 : 202, check: result.data, location: result.location };
  },

  /** `GET …/health-checks/{checkId}` — progress of one run. */
  async get(serialNumber: string, checkId: string, signal?: AbortSignal): Promise<HealthCheck> {
    const { data } = await apiRequest({
      path: `${checksPath(serialNumber)}/${enc(checkId)}`,
      schema: healthCheckSchema,
      signal,
    });
    return data;
  },

  /** `POST /link/v1/contract-links/{contractId}/fault-reports` → 201 ticket (P6-01, proposed B-09). */
  async createFaultReport(
    contractId: string,
    checkId: string | null,
    idempotencyKey: string,
  ): Promise<FaultReport> {
    const { data } = await apiRequest({
      path: `/link/v1/contract-links/${enc(contractId)}/fault-reports`,
      method: 'POST',
      schema: faultReportSchema,
      body: { checkId },
      idempotencyKey,
    });
    return data;
  },
};
