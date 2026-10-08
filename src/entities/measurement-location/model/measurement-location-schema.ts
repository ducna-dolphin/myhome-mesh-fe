import { z } from 'zod';
import type { AcceptsContract, ApiSchemas } from '@/shared/api';

export const signalLevelSchema = z.enum(['GOOD', 'FAIR', 'WEAK']);

/** Grid cell of a measurement location with its latest result (P2-01, VT-05). */
export const measurementLocationSchema = z.object({
  locationId: z.string().min(1),
  name: z.string(),
  latestLevel: signalLevelSchema.nullable().optional(),
  latestMeasuredAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const measurementLocationListSchema = z.array(measurementLocationSchema);

/** One saved measurement; only the level is shown, never speed or dBm (QD-06). */
export const measurementSchema = z.object({
  measurementId: z.string().min(1),
  level: signalLevelSchema,
  measuredAt: z.string(),
});

export const measurementListSchema = z.array(measurementSchema);

export const deletedLocationSchema = z.object({ locationId: z.string().optional() });

/** VT-01: at most 20 locations per contract (including unmeasured ones). */
export const MAX_MEASUREMENT_LOCATIONS = 20;
export const LOCATION_NAME_MAX_LENGTH = 30;

/** VT-02: 1–30 chars, letters/digits/space and a few separators (exact allowed set pending). */
export const locationNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(LOCATION_NAME_MAX_LENGTH)
  .regex(/^[\p{L}\p{M}\p{N} _\-.,()/']+$/u, 'INVALID_CHARACTERS');

void (true satisfies AcceptsContract<typeof measurementLocationSchema, ApiSchemas['MeasurementLocation']>);
void (true satisfies AcceptsContract<typeof measurementSchema, ApiSchemas['Measurement']>);

export type SignalLevel = z.infer<typeof signalLevelSchema>;
export type MeasurementLocation = z.infer<typeof measurementLocationSchema>;
export type Measurement = z.infer<typeof measurementSchema>;

const levelRank: Record<SignalLevel, number> = { WEAK: 0, FAIR: 1, GOOD: 2 };

/** VT-04: WEAK → FAIR → GOOD → not measured; same level by creation time. */
export function sortMeasurementLocations(locations: MeasurementLocation[]): MeasurementLocation[] {
  return [...locations].sort((a, b) => {
    const rankA = a.latestLevel ? levelRank[a.latestLevel] : 3;
    const rankB = b.latestLevel ? levelRank[b.latestLevel] : 3;
    return rankA - rankB || (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  });
}

/** §IV.2.8: show the "install Mesh" advice when any location's latest level is WEAK. */
export function shouldRecommendMesh(locations: MeasurementLocation[]): boolean {
  return locations.some((location) => location.latestLevel === 'WEAK');
}
