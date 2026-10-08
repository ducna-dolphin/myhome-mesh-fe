import type { z } from 'zod';
import type { components } from './generated/openapi';

/** Schemas generated from `contracts/openapi.yaml` (`npm run gen:api`). */
export type ApiSchemas = components['schemas'];

/**
 * `true` when every value valid under the OpenAPI type `Contract` is accepted by the Zod schema's
 * input type. Use as `void (true satisfies AcceptsContract<typeof schema, Schemas['X']>);` so a
 * contract change that the schema would reject fails typecheck.
 */
export type AcceptsContract<Schema extends z.ZodTypeAny, Contract> = [Contract] extends [z.input<Schema>]
  ? true
  : false;
