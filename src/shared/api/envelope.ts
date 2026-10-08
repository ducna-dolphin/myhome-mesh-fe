import { z } from 'zod';

/** `meta` of read responses (CF §2.2). */
export const readMetaSchema = z.object({
  source: z.enum(['LIVE', 'CACHE']).optional(),
  updatedAt: z.string().nullable().optional(),
  stale: z.boolean().optional(),
});

/** Partial failures inside a `200` (CF §2.2). Codes stay open-ended so new backend codes do not break parsing. */
export const partialErrorSchema = z.object({
  code: z.string(),
  target: z.string(),
});

export const partialErrorsSchema = z.array(partialErrorSchema);

/** Error envelope (CF §3.1). */
export const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
    traceId: z.string().optional(),
    retryable: z.boolean().optional(),
    retryAfterSec: z.number().int().nonnegative().optional(),
    details: z
      .array(
        z.object({
          field: z.string().optional(),
          code: z.string().optional(),
          message: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export type ReadMeta = z.infer<typeof readMetaSchema>;
export type PartialError = z.infer<typeof partialErrorSchema>;

/** Read result that keeps `meta` (stale label) and `errors[]` (per-block failures) for the UI. */
export interface WithMeta<T> {
  data: T;
  meta: ReadMeta | null;
  errors: PartialError[];
}

/** True when the block identified by `target` failed in a partial response. */
export function hasPartialError(result: Pick<WithMeta<unknown>, 'errors'>, target: string): boolean {
  return result.errors.some((error) => error.target === target);
}
