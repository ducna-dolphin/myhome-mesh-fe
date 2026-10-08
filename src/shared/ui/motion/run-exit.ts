/** Grace period added to the computed duration before the fallback timer fires. */
const EXIT_FALLBACK_SLACK_MS = 80;

function parseTimeList(value: string): number[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.endsWith('ms') ? parseFloat(part) : parseFloat(part) * 1000))
    .map((ms) => (Number.isFinite(ms) ? ms : 0));
}

/**
 * Longest `delay + duration` of the CSS animations and transitions currently applied to `element`,
 * in ms. 0 when nothing animates — including jsdom (no stylesheets) and reduced motion with the
 * tokens zeroed — so callers can finish synchronously.
 */
export function motionDurationMs(element: Element | null | undefined): number {
  if (!element || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return 0;
  const style = window.getComputedStyle(element);
  const longest = (durations: string, delays: string) => {
    const d = parseTimeList(durations ?? '');
    const l = parseTimeList(delays ?? '');
    return d.reduce((max, duration, index) => Math.max(max, duration + (l[index] ?? l[0] ?? 0)), 0);
  };
  const animation =
    style.animationName && style.animationName !== 'none'
      ? longest(style.animationDuration, style.animationDelay)
      : 0;
  const transition = longest(style.transitionDuration, style.transitionDelay);
  return Math.max(animation, transition);
}

/**
 * Waits for the exit animation/transition of `element` (already started by the caller, e.g. via
 * `data-state="closing"`), then calls `done` exactly once. Resolves on `animationend` /
 * `transitionend` of the element itself, with a timeout fallback (hidden tabs pause animations,
 * old WebViews drop events). Calls `done` synchronously when nothing animates.
 * Returns a cleanup that cancels the wait without calling `done`.
 */
export function runExit(element: Element | null | undefined, done: () => void): () => void {
  const duration = motionDurationMs(element);
  if (!element || duration <= 0) {
    done();
    return () => {};
  }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    cleanup();
    done();
  };
  const onEnd = (event: Event) => {
    if (event.target === element) finish();
  };
  const timer = setTimeout(finish, duration + EXIT_FALLBACK_SLACK_MS);
  element.addEventListener('animationend', onEnd);
  element.addEventListener('transitionend', onEnd);
  function cleanup() {
    clearTimeout(timer);
    element?.removeEventListener('animationend', onEnd);
    element?.removeEventListener('transitionend', onEnd);
  }
  return () => {
    finished = true;
    cleanup();
  };
}

/** `prefers-reduced-motion: reduce` (false where matchMedia is missing, e.g. jsdom). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
