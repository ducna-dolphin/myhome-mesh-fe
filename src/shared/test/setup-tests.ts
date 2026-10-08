import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@/shared/i18n';

// MSW-backed hooks can be slower than 1s when the whole suite runs in parallel.
configure({ asyncUtilTimeout: 3_000 });

afterEach(() => {
  cleanup();
});
