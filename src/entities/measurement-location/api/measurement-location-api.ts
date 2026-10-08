import { apiRequest } from '@/shared/api';
import {
  deletedLocationSchema,
  measurementListSchema,
  measurementLocationListSchema,
  measurementLocationSchema,
  measurementSchema,
  type Measurement,
  type MeasurementLocation,
} from '../model/measurement-location-schema';
import { toMeasurementInput, type MeasurementSubmission } from '../model/measurement-submission';
import { signalThresholdsSchema, type SignalThresholds } from '../model/signal-thresholds';

const locationPath = (locationId: string) =>
  `/mesh/v1/measurement-locations/${encodeURIComponent(locationId)}`;

export const measurementLocationApi = {
  /** `GET /mesh/v1/measurement-locations?contractId=` (P2-01). */
  async list(contractId: string, signal?: AbortSignal): Promise<MeasurementLocation[]> {
    const { data } = await apiRequest({
      path: '/mesh/v1/measurement-locations',
      query: { contractId },
      schema: measurementLocationListSchema,
      signal,
    });
    return data;
  },

  /** `POST /mesh/v1/measurement-locations` → 201 (P2-02). */
  async create(contractId: string, name: string, idempotencyKey: string): Promise<MeasurementLocation> {
    const { data } = await apiRequest({
      path: '/mesh/v1/measurement-locations',
      method: 'POST',
      schema: measurementLocationSchema,
      body: { contractId, name },
      idempotencyKey,
    });
    return data;
  },

  /** `PATCH /mesh/v1/measurement-locations/{locationId}` (P2-05). */
  async rename(locationId: string, name: string, idempotencyKey: string): Promise<MeasurementLocation> {
    const { data } = await apiRequest({
      path: locationPath(locationId),
      method: 'PATCH',
      schema: measurementLocationSchema,
      body: { name },
      idempotencyKey,
    });
    return data;
  },

  /** `DELETE /mesh/v1/measurement-locations/{locationId}` — also deletes its history (P2-05). */
  async remove(locationId: string, idempotencyKey: string): Promise<void> {
    await apiRequest({
      path: locationPath(locationId),
      method: 'DELETE',
      schema: deletedLocationSchema,
      idempotencyKey,
    });
  },

  /** `GET …/{locationId}/measurements` — latest 5, newest first (P2-06). */
  async listMeasurements(locationId: string, signal?: AbortSignal): Promise<Measurement[]> {
    const { data } = await apiRequest({
      path: `${locationPath(locationId)}/measurements`,
      schema: measurementListSchema,
      signal,
    });
    return data;
  },

  /**
   * `POST …/{locationId}/measurements` → 201 (P2-03, P2-04). Resend with the same key after a
   * network failure (LS-02); `measuredAt` must be the original measurement time.
   */
  async createMeasurement(
    locationId: string,
    submission: MeasurementSubmission,
    measuredAt: string,
    idempotencyKey: string,
  ): Promise<Measurement> {
    const { data } = await apiRequest({
      path: `${locationPath(locationId)}/measurements`,
      method: 'POST',
      schema: measurementSchema,
      body: toMeasurementInput(submission, measuredAt),
      idempotencyKey,
    });
    return data;
  },

  /** `GET /mesh/v1/signal-thresholds` normalized to `{ androidMethod, speed, rssi }`. */
  async getSignalThresholds(signal?: AbortSignal): Promise<SignalThresholds> {
    const { data } = await apiRequest({
      path: '/mesh/v1/signal-thresholds',
      schema: signalThresholdsSchema,
      signal,
    });
    return data;
  },
};
