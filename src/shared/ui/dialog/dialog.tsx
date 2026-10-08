import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../class-names';
import { Spinner } from '../spinner/spinner';
import { useModalDialog } from '../modal/use-modal-dialog';
import { useOverlayPresence } from '../motion';
import '../modal/modal.css';
import './dialog.css';

export interface DialogProps {
  open: boolean;
  /** Called after the exit animation of cancel, scrim tap and Esc. The owner sets `open` to false. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  /** Omit for an alert with a single button. */
  cancelLabel?: string;
  /** Red confirm label (delete actions). */
  destructive?: boolean;
  /** Confirm action in flight: shows a spinner, blocks both buttons and dismissal. */
  confirmLoading?: boolean;
  /** Extra content between description and actions (e.g. a TextField for rename). */
  children?: ReactNode;
}

/**
 * XD-style centred alert/confirm: title, description and side-by-side text actions.
 * Exposed as `alertdialog`; initial focus lands on the cancel action (safe default) when present.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  cancelLabel,
  destructive = false,
  confirmLoading = false,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { present, exiting, requestClose } = useOverlayPresence(open, onClose, () => panelRef.current);
  const { native, onKeyDown, onClick } = useModalDialog(ref, present, requestClose, {
    dismissible: !confirmLoading,
  });

  // Keep the last content on screen while the dialog fades out after `open` turned false.
  const content = useRef({ title, description, confirmLabel, cancelLabel, children });
  if (open) content.current = { title, description, confirmLabel, cancelLabel, children };
  const shown = open ? { title, description, confirmLabel, cancelLabel, children } : content.current;
  const hasCancel = shown.cancelLabel !== undefined;

  return createPortal(
    <dialog
      ref={ref}
      className={cx('ui-modal', 'ui-dialog', !native && 'ui-modal--fallback')}
      data-state={exiting ? 'closing' : 'open'}
      role="alertdialog"
      aria-modal={native ? undefined : true}
      aria-labelledby={titleId}
      aria-describedby={shown.description ? descriptionId : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      {present && (
        <div className="ui-dialog__panel" ref={panelRef}>
          <div className="ui-dialog__content">
            <h2 className="ui-dialog__title" id={titleId}>
              {shown.title}
            </h2>
            {shown.description && (
              <div className="ui-dialog__description" id={descriptionId}>
                {shown.description}
              </div>
            )}
            {shown.children}
          </div>
          <div className={cx('ui-dialog__actions', !hasCancel && 'ui-dialog__actions--single')}>
            {hasCancel && (
              <button
                type="button"
                className="ui-dialog__action"
                onClick={requestClose}
                disabled={confirmLoading}
                data-autofocus
              >
                {shown.cancelLabel}
              </button>
            )}
            <button
              type="button"
              className={cx(
                'ui-dialog__action',
                'ui-dialog__action--confirm',
                destructive && 'ui-dialog__action--destructive',
              )}
              onClick={onConfirm}
              disabled={confirmLoading}
              aria-busy={confirmLoading || undefined}
              data-autofocus={hasCancel ? undefined : true}
            >
              {confirmLoading && <Spinner size={16} />}
              {shown.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>,
    document.body,
  );
}
