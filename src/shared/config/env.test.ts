import { describe, expect, it } from 'vitest';
import { defaultApiMode, env } from './env';

describe('env', () => {
  it('defaults VITE_API_MODE to remote in production builds and mock otherwise', () => {
    expect(defaultApiMode(true)).toBe('remote');
    expect(defaultApiMode(false)).toBe('mock');
  });

  it('uses mock data under test (non-production)', () => {
    expect(env.VITE_API_MODE).toBe('mock');
  });
});
