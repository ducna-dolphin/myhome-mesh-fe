import { afterEach, describe, expect, it, vi } from 'vitest';
import { motionDurationMs, runExit } from './run-exit';
import { shouldDismissSheet } from './swipe-dismiss';

function stubAnimation(duration: string, delay = '0s') {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = real(element);
    return Object.assign(Object.create(style) as CSSStyleDeclaration, {
      animationName: 'ui-sheet-out',
      animationDuration: duration,
      animationDelay: delay,
      transitionDuration: '0s',
      transitionDelay: '0s',
    });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('shouldDismissSheet', () => {
  it.each([
    // distance, elapsed, height, expected
    [0, 100, 400, false],
    [-80, 100, 400, false],
    [20, 10, 400, false], // tap jitter, even if "fast"
    [119, 600, 400, false], // slow and below 30 % of 400
    [120, 600, 400, true], // 30 % of the sheet
    [160, 900, 800, true], // capped at 160px for tall sheets
    [40, 60, 400, true], // quick flick
    [40, 200, 400, false], // same distance, too slow
  ])('distance %ipx in %ims on a %ipx sheet → %s', (distance, elapsedMs, sheetHeight, expected) => {
    expect(shouldDismissSheet({ distance, elapsedMs, sheetHeight })).toBe(expected);
  });
});

describe('runExit', () => {
  it('finishes synchronously when nothing animates (jsdom, reduced motion)', () => {
    const done = vi.fn();
    runExit(document.createElement('div'), done);
    expect(done).toHaveBeenCalledTimes(1);
    expect(motionDurationMs(null)).toBe(0);
  });

  it('waits for animationend of the element itself', () => {
    stubAnimation('260ms');
    const element = document.createElement('div');
    const child = document.createElement('span');
    element.append(child);
    const done = vi.fn();
    runExit(element, done);

    child.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(done).not.toHaveBeenCalled();
    element.dispatchEvent(new Event('animationend'));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timeout when no end event arrives, and can be cancelled', () => {
    vi.useFakeTimers();
    stubAnimation('0.2s', '50ms');
    const done = vi.fn();
    runExit(document.createElement('div'), done);
    vi.advanceTimersByTime(250);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(done).toHaveBeenCalledTimes(1);

    const cancelled = vi.fn();
    const cancel = runExit(document.createElement('div'), cancelled);
    cancel();
    vi.advanceTimersByTime(1000);
    expect(cancelled).not.toHaveBeenCalled();
  });
});
