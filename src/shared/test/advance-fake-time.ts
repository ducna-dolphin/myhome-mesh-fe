import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Advances Vitest fake timers in small steps inside `act`, so fetches (MSW), microtasks and
 * TanStack Query notifications settle between ticks.
 */
export async function advanceFakeTime(ms = 0, step = 50): Promise<void> {
  let elapsed = 0;
  do {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(step, Math.max(ms - elapsed, 0)));
    });
    elapsed += step;
  } while (elapsed < ms);
}

/** Fake only timers and Date; keeps queueMicrotask/nextTick real so MSW can respond. */
export function installFakeClock(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
}
