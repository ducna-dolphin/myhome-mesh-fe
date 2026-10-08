import { z } from 'zod';

export type ApiMode = 'mock' | 'remote';

/** Explicit `VITE_API_MODE` wins; otherwise production builds call the real API, dev/test use MSW. */
export function defaultApiMode(isProduction: boolean): ApiMode {
  return isProduction ? 'remote' : 'mock';
}

const schema = z.object({
  VITE_API_MODE: z.enum(['mock', 'remote']).default(defaultApiMode(import.meta.env.PROD)),
  VITE_API_BASE_URL: z.string().url().default('https://api.example.local'),
  VITE_SHOW_SPEC_NOTES: z.enum(['true', 'false']).optional(),
  // Browser bridge mock (used outside the Flutter host only).
  VITE_MOCK_PLATFORM: z.enum(['android', 'ios', 'web']).default('android'),
  VITE_MOCK_ANDROID_METHOD: z.enum(['SPEED', 'RSSI', 'NONE']).default('SPEED'),
  // MSW scenarios for the LLD API (mock mode only).
  VITE_MOCK_CONTRACTS: z.enum(['none', 'one', 'many']).default('one'),
  VITE_MOCK_SERIAL: z.enum(['present', 'missing']).default('present'),
  VITE_MOCK_SURVEY: z.enum(['empty', 'partial', 'full']).default('full'),
  VITE_MOCK_HEALTH: z.enum(['stable', 'unstable', 'down', 'off', 'fail', 'hogged']).default('stable'),
  VITE_MOCK_DEVICE: z.enum(['online', 'offline']).default('online'),
});

export type AppEnv = z.infer<typeof schema>;

export const env = schema.parse(import.meta.env);

/** Value sent in `X-Client-Version` (CF §1.3). */
export const clientVersion = `miniapp-mesh/${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'}`;

/** Pending-spec tooltips: explicit flag wins, otherwise shown only in mock mode. */
export const showSpecNotes = env.VITE_SHOW_SPEC_NOTES
  ? env.VITE_SHOW_SPEC_NOTES === 'true'
  : env.VITE_API_MODE === 'mock';
