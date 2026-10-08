import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig(({ command, mode }) => {
  // Production builds talk to the real API unless VITE_API_MODE is set explicitly (env or .env file).
  // Defined statically so `src/main.tsx` can drop the MSW chunk from the bundle.
  const explicitApiMode = loadEnv(mode, process.cwd(), 'VITE_API_MODE').VITE_API_MODE;
  const apiModeDefine =
    command === 'build' && !explicitApiMode
      ? { 'import.meta.env.VITE_API_MODE': JSON.stringify(mode === 'development' ? 'mock' : 'remote') }
      : {};

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      ...apiModeDefine,
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      target: 'es2022',
      sourcemap: false,
    },
    server: {
      host: true,
      port: 5173,
    },
    test: {
      environment: 'jsdom',
      // MSW node server lives in the app layer because it aggregates every entity's handlers.
      exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
      setupFiles: ['./src/shared/test/setup-tests.ts', './src/app/mocks/setup-mock-server.ts'],
      css: false,
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: ['src/**/*.test.*', 'src/**/*.d.ts', 'src/main.tsx', 'src/shared/api/generated/**'],
        thresholds: {
          lines: 60,
          'src/shared/**': { lines: 70 },
          'src/entities/**': { lines: 70 },
          'src/features/**': { lines: 70 },
          'src/widgets/**': { lines: 70 },
        },
      },
    },
  };
});
