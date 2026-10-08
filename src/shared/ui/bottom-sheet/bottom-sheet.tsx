import { X } from 'lucide-react';
import { useId, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../class-names';
import { IconButton } from '../icon-button/icon-button';
import { useModalDialog } from '../modal/use-modal-dialog';
import { resistDrag, shouldDismissSheet, useOverlayPresence } from '../motion';
import '../modal/modal.css';
import './bottom-sheet.css';

export interface BottomSheetProps {
  open: boolean;
  /**
   * Called after the exit animation of a close request (close button, scrim tap, Esc / Android
   * back, swipe down). The owner sets `open` to false or unmounts the sheet.
   */
  onClose: () => void;
  title?: ReactNode;
  /** Accessible name of the close (X) button. Required unless `hideCloseButton`. */
  closeLabel?: string;
  hideCloseButton?: boolean;
  /** Sticky actions area under the scrollable body (respects the bottom safe area). */
  footer?: ReactNode;
  /** Set false while a blocking operation runs (e.g. measuring) to ignore scrim/Esc/swipe. */
  dismissible?: boolean;
  /** Accessible name when there is no visible title. */
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
}

interface DragState {
  pointerId: number;
  startY: number;
  startTime: number;
  distance: number;
}

/**
 * Native-feel bottom sheet: slides up over a fading scrim, slides down on close (the owner's
 * `onClose` runs once the exit ends), and can be swiped down from the grabber/header.
 * When `open` turns false from outside (e.g. back button), the last content animates out.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  closeLabel,
  hideCloseButton = false,
  footer,
  dismissible = true,
  ariaLabel,
  className,
  children,
}: BottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const titleId = useId();
  const { present, exiting, requestClose } = useOverlayPresence(open, onClose, () => panelRef.current);
  const dismiss = () => {
    if (dismissible) requestClose();
  };
  const { native, onKeyDown, onClick } = useModalDialog(ref, present, dismiss, { dismissible });
  const showClose = !hideCloseButton && closeLabel !== undefined;

  // Keep the last content on screen while the sheet animates out after `open` turned false.
  const content = useRef({ title, footer, children });
  if (open) content.current = { title, footer, children };
  const shown = open ? { title, footer, children } : content.current;

  const setDrag = (distance: number) => {
    panelRef.current?.style.setProperty('--sheet-drag', `${distance}px`);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dismissible || exiting || (event.pointerType === 'mouse' && event.button !== 0)) return;
    // The close button keeps its own tap.
    if ((event.target as Element).closest('button, a, input')) return;
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTime: event.timeStamp,
      distance: 0,
    };
    try {
      // Keep receiving moves when the finger leaves the handle.
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic or already-released pointer: plain bubbling moves still work.
    }
    panelRef.current?.setAttribute('data-dragging', '');
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.distance = event.clientY - current.startY;
    setDrag(resistDrag(current.distance));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    const panel = panelRef.current;
    panel?.removeAttribute('data-dragging');
    const dismissed =
      !cancelled &&
      shouldDismissSheet({
        distance: current.distance,
        elapsedMs: event.timeStamp - current.startTime,
        sheetHeight: panel?.offsetHeight ?? 0,
      });
    if (dismissed) {
      // The exit keyframes start from the dragged offset (`--sheet-drag`).
      requestClose();
    } else {
      setDrag(0);
    }
  };

  const dragHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => endDrag(event, false),
    onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => endDrag(event, true),
  };

  return createPortal(
    <dialog
      ref={ref}
      className={cx('ui-modal', 'ui-sheet', !native && 'ui-modal--fallback', className)}
      data-state={exiting ? 'closing' : 'open'}
      aria-labelledby={shown.title ? titleId : undefined}
      aria-label={shown.title ? undefined : ariaLabel}
      aria-modal={native ? undefined : true}
      role="dialog"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      {present && (
        <div className="ui-sheet__panel" ref={panelRef}>
          <div className={cx('ui-sheet__handle', dismissible && 'is-draggable')} {...dragHandlers}>
            <div className="ui-sheet__grabber" aria-hidden="true" />
            {/* Not <header>: inside <dialog> it would count as a second banner landmark. */}
            {(shown.title || showClose) && (
              <div className="ui-sheet__header">
                {shown.title && (
                  <h2 className="ui-sheet__title" id={titleId}>
                    {shown.title}
                  </h2>
                )}
                {showClose && (
                  <IconButton
                    icon={X}
                    label={closeLabel}
                    variant="ghost"
                    className="ui-sheet__close"
                    onClick={requestClose}
                  />
                )}
              </div>
            )}
          </div>
          <div className="ui-sheet__body">{shown.children}</div>
          {shown.footer && <div className="ui-sheet__footer">{shown.footer}</div>}
        </div>
      )}
    </dialog>,
    document.body,
  );
}
