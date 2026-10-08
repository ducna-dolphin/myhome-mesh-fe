import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { pendingSpecNotes, type PendingSpecNoteId } from '@/shared/config/pending-spec-notes';
import { showSpecNotes } from '@/shared/config/env';
import { useTranslation } from '@/shared/i18n';
import './spec-note.css';

interface SpecNoteProps {
  id: PendingSpecNoteId;
  className?: string;
}

/**
 * Marker for a UI detail still pending partner confirmation.
 * Visibility is driven only by state: mouse hover, keyboard focus or tap opens it;
 * Escape, blur, mouse leave or a tap outside closes it.
 * The tooltip spans the nearest positioned ancestor (the row), so it never overflows the screen.
 */
export function SpecNote({ id, className = '' }: SpecNoteProps) {
  const { t } = useTranslation('common');
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const lastPointerTypeRef = useRef<string>('');

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (!showSpecNotes) return null;

  // Touch taps also emit pointerenter/focus; only mouse hover and keyboard focus open implicitly.
  const openOnMouse = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') setOpen(true);
  };
  const closeOnMouse = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') setOpen(false);
  };
  // Mouse users already opened it by hovering, so a click keeps it open instead of toggling it shut.
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const isMouseClick = event.detail > 0 && lastPointerTypeRef.current === 'mouse';
    setOpen((value) => (isMouseClick ? true : !value));
  };
  const openOnKeyboardFocus = (event: FocusEvent<HTMLButtonElement>) => {
    if (event.currentTarget.matches(':focus-visible')) setOpen(true);
  };

  return (
    <span
      ref={rootRef}
      className={`spec-note ${className}`.trim()}
      onPointerEnter={openOnMouse}
      onPointerLeave={closeOnMouse}
    >
      <button
        className="spec-note__trigger"
        type="button"
        aria-label={t('specNote.label')}
        aria-describedby={tooltipId}
        onPointerDown={(event) => {
          lastPointerTypeRef.current = event.pointerType;
        }}
        onClick={handleClick}
        onFocus={openOnKeyboardFocus}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      <span className="spec-note__tooltip" id={tooltipId} role="tooltip" hidden={!open}>
        <strong aria-hidden="true">{t('specNote.label')}</strong>
        {pendingSpecNotes[id]}
      </span>
    </span>
  );
}
