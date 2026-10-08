import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { runExit } from './run-exit';

export interface OverlayPresence {
  /** Keep the overlay rendered (and the `<dialog>` shown): true while open and during its exit. */
  present: boolean;
  /** Exit animation running: style it with `data-state="closing"`. */
  exiting: boolean;
  /**
   * Plays the exit, then calls the owner's `onClose`. Use for the overlay's own dismissals
   * (close button, scrim, Esc, swipe); owners that unmount on `onClose` still get the exit.
   */
  requestClose: () => void;
}

/**
 * Presence of a controlled overlay with an exit animation. The overlay stays mounted while it
 * animates out — after `open` turns false or after `requestClose()` — and unmounts on
 * `animationend`/`transitionend` of `getExitElement()` (timeout fallback; synchronous when nothing
 * animates, e.g. jsdom or reduced motion).
 */
export function useOverlayPresence(
  open: boolean,
  onClose: () => void,
  getExitElement: () => Element | null,
): OverlayPresence {
  const [requested, setRequested] = useState(false);
  const target = open && !requested;
  const [present, setPresent] = useState(target);
  const [exiting, setExiting] = useState(false);
  const [previousTarget, setPreviousTarget] = useState(target);

  // The owner acknowledged the close request: forget it so a later `open` shows the overlay again.
  if (!open && requested) setRequested(false);
  if (target !== previousTarget) {
    setPreviousTarget(target);
    if (target) {
      setPresent(true);
      setExiting(false);
    } else if (present) {
      setExiting(true);
    }
  }

  const onCloseRef = useRef(onClose);
  const getElementRef = useRef(getExitElement);
  const notifyOwnerRef = useRef(false);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    getElementRef.current = getExitElement;
  });

  useLayoutEffect(() => {
    if (!exiting) return;
    return runExit(getElementRef.current(), () => {
      setExiting(false);
      setPresent(false);
      if (notifyOwnerRef.current) {
        notifyOwnerRef.current = false;
        onCloseRef.current();
      }
    });
  }, [exiting]);

  const requestClose = useCallback(() => {
    if (notifyOwnerRef.current) return;
    notifyOwnerRef.current = true;
    setRequested(true);
  }, []);

  return { present, exiting, requestClose };
}
