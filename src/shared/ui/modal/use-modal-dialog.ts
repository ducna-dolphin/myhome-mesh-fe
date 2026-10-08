import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let scrollLocks = 0;
let previousOverflow = '';

function lockScroll() {
  if (scrollLocks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
}

/** Native modal `<dialog>` support (missing in Android WebView < Chrome 98 and in jsdom). */
export function supportsNativeModal(): boolean {
  return (
    typeof HTMLDialogElement === 'function' && typeof HTMLDialogElement.prototype.showModal === 'function'
  );
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
}

interface ModalDialogHandlers {
  onKeyDown: (event: KeyboardEvent<HTMLDialogElement>) => void;
  onClick: (event: MouseEvent<HTMLDialogElement>) => void;
  native: boolean;
}

/**
 * Drives a controlled `<dialog>`: `showModal()` when supported, otherwise an `open` dialog styled
 * as a fixed overlay with a hand-written focus trap. In both modes it locks body scroll, closes on
 * Esc / scrim click via `onClose`, and returns focus to the element that opened it.
 */
export function useModalDialog(
  ref: RefObject<HTMLDialogElement | null>,
  open: boolean,
  onClose: () => void,
  { dismissible = true }: { dismissible?: boolean } = {},
): ModalDialogHandlers {
  const native = supportsNativeModal();
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;

    const returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockScroll();

    if (native) {
      if (!dialog.open) dialog.showModal();
      // showModal() may have scrolled the layer to its first focusable during the entrance.
      dialog.scrollTop = 0;
    } else {
      dialog.setAttribute('open', '');
    }
    // `data-autofocus` marks the preferred initial focus (React's autoFocus runs before the dialog
    // is shown); `data-autofocus="select"` also selects an input's text (rename). Without one, the
    // dialog itself takes focus: a tap-opened sheet should not paint a ring on its close button.
    const preferred = dialog.querySelector<HTMLElement>('[data-autofocus]');
    if (preferred) {
      preferred.focus({ preventScroll: true });
      if (preferred.dataset.autofocus === 'select' && preferred instanceof HTMLInputElement)
        preferred.select();
    } else {
      dialog.focus({ preventScroll: true });
    }

    // Native Esc (and Android back on recent WebViews) arrives as `cancel`; keep the dialog
    // controlled by letting the owner decide.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (dismissibleRef.current) onCloseRef.current();
    };
    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      if (native) {
        if (dialog.open) dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
      unlockScroll();
      if (returnFocusTo?.isConnected) returnFocusTo.focus();
    };
  }, [open, native, ref]);

  return {
    native,
    onKeyDown(event) {
      if (native) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (dismissibleRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables(event.currentTarget);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    onClick(event) {
      // The dialog element is the full-screen layer; only a click on it (not the panel) hits the scrim.
      if (event.target === event.currentTarget && dismissibleRef.current) onCloseRef.current();
    },
  };
}
