import { CircleAlert, CircleCheck } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { cx } from '../class-names';
import { Icon } from '../icon/icon';
import { runExit } from '../motion';
import { ToastContext, type ToastApi, type ToastOptions, type ToastTone } from './toast-context';
import './toast.css';

export const TOAST_DURATION_MS = 3000;

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
  leaving: boolean;
}

/** Popover API: the region is a manual popover so it can be raised above open modal dialogs. */
function raiseAboveModals(region: HTMLElement | null) {
  if (!region || typeof region.showPopover !== 'function') return;
  try {
    if (region.matches(':popover-open')) region.hidePopover();
    region.showPopover();
  } catch {
    // Not connected or unsupported state: the toast still renders in normal stacking.
  }
}

/**
 * Single-slot toast (teal, full width, above the bottom safe area). The `role="status"` live
 * region is always mounted so screen readers announce each new message politely. It lives in the
 * top layer (manual popover, re-shown per toast) so it is visible above open sheets and dialogs.
 */
export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextId = useRef(0);
  const regionRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);

  const leave = useCallback(() => {
    clearTimeout(timer.current);
    setToast((current) => (current ? { ...current, leaving: true } : null));
  }, []);

  const show = useCallback(
    (message: string, { tone = 'brand', duration = TOAST_DURATION_MS }: ToastOptions = {}) => {
      clearTimeout(timer.current);
      nextId.current += 1;
      setToast({ id: nextId.current, message, tone, leaving: false });
      timer.current = setTimeout(leave, duration);
    },
    [leave],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const toastId = toast?.id;
  const leaving = toast?.leaving ?? false;
  useLayoutEffect(() => {
    if (toastId !== undefined && !leaving) raiseAboveModals(regionRef.current);
  }, [toastId, leaving]);

  useLayoutEffect(() => {
    if (!leaving || toastId === undefined) return;
    return runExit(toastRef.current, () => setToast((current) => (current?.id === toastId ? null : current)));
  }, [leaving, toastId]);

  const api = useMemo<ToastApi>(() => ({ show, hide: leave }), [show, leave]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        ref={regionRef}
        className="ui-toast-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        popover="manual"
      >
        {toast && (
          <div
            ref={toastRef}
            key={toast.id}
            className={cx('ui-toast', `ui-toast--${toast.tone}`)}
            data-state={toast.leaving ? 'closing' : 'open'}
          >
            <Icon icon={toast.tone === 'danger' ? CircleAlert : CircleCheck} className="ui-toast__icon" />
            <span className="ui-toast__message">{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
