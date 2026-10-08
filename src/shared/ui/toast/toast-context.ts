import { createContext, useContext } from 'react';

export type ToastTone = 'brand' | 'danger';

export interface ToastOptions {
  tone?: ToastTone;
  /** Auto-hide delay in ms (default 3000). */
  duration?: number;
}

export interface ToastApi {
  /** Shows a toast, replacing any visible one. */
  show: (message: string, options?: ToastOptions) => void;
  hide: () => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
