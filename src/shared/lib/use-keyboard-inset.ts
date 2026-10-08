import { useEffect } from 'react';

/** CSS custom property (on `<html>`) with the height covered by the on-screen keyboard, in px. */
export const KEYBOARD_INSET_PROPERTY = '--keyboard-inset';

/**
 * Height of the layout viewport hidden below the visual viewport — the on-screen keyboard on iOS
 * WKWebView, which does not resize the layout viewport (Android WebViews usually do: 0 there).
 */
export function keyboardInset(layoutHeight: number, visualHeight: number, visualOffsetTop: number): number {
  return Math.max(0, Math.round(layoutHeight - visualHeight - visualOffsetTop));
}

/**
 * Keeps `--keyboard-inset` up to date from `visualViewport`, so fixed sheets and sticky CTAs can
 * stay above the keyboard (`bottom: var(--keyboard-inset, 0px)`). Mount once (app shell).
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const inset = keyboardInset(window.innerHeight, viewport.height, viewport.offsetTop);
        root.style.setProperty(KEYBOARD_INSET_PROPERTY, `${inset}px`);
      });
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty(KEYBOARD_INSET_PROPERTY);
    };
  }, []);
}
