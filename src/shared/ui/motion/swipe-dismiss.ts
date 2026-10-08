export interface SwipeSample {
  /** Downward drag distance in px (negative = dragged up). */
  distance: number;
  /** Duration of the gesture in ms. */
  elapsedMs: number;
  /** Height of the sheet panel in px. */
  sheetHeight: number;
}

/** A drag longer than this share of the sheet (capped) dismisses it. */
export const SWIPE_DISTANCE_RATIO = 0.3;
export const SWIPE_DISTANCE_MAX_PX = 160;
/** A flick faster than this (px/ms) dismisses even when short… */
export const SWIPE_VELOCITY_PX_PER_MS = 0.5;
/** …as long as it travelled at least this far (filters taps and jitter). */
export const SWIPE_MIN_FLICK_PX = 24;

/**
 * Swipe-down-to-dismiss decision for the bottom sheet (iOS/Android convention): far enough, or a
 * quick downward flick. Upward or tiny drags always snap back.
 */
export function shouldDismissSheet({ distance, elapsedMs, sheetHeight }: SwipeSample): boolean {
  if (distance <= 0) return false;
  const threshold = Math.min(sheetHeight * SWIPE_DISTANCE_RATIO, SWIPE_DISTANCE_MAX_PX);
  if (distance >= threshold) return true;
  const velocity = distance / Math.max(elapsedMs, 1);
  return distance >= SWIPE_MIN_FLICK_PX && velocity >= SWIPE_VELOCITY_PX_PER_MS;
}

/** Rubber-band resistance when dragging the sheet up past its resting position. */
export function resistDrag(distance: number): number {
  return distance >= 0 ? distance : -Math.sqrt(-distance) * 2;
}
