import { useCallback, useEffect, useRef, useState } from 'react';
import { buildWifiQrPayload, useRevealWifiPasswordMutation } from '@/entities/wifi-network';

/** Renders a QR payload as a PNG data URL. `qrcode` is loaded on demand to keep it out of the main chunk. */
export async function renderWifiQrDataUrl(payload: string): Promise<string> {
  const { toDataURL } = await import('qrcode');
  return toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 512 });
}

export type WifiQrImageState =
  | { status: 'loading'; dataUrl: null; error: null }
  | { status: 'ready'; dataUrl: string; error: null }
  | { status: 'error'; dataUrl: null; error: unknown };

/**
 * Reveals the password (purpose QR), builds `WIFI:T:WPA;S:…;P:…;;` and renders it to an image.
 * The plain password only exists inside this function call; the component keeps the image, which
 * is dropped with the component state on unmount (LLD §11.5).
 */
export function useWifiQrImage(serialNumber: string, wifiIndex: number) {
  const { mutateAsync, reset } = useRevealWifiPasswordMutation(serialNumber);
  const [state, setState] = useState<WifiQrImageState>({ status: 'loading', dataUrl: null, error: null });
  const mounted = useRef(true);
  const started = useRef(false);

  const load = useCallback(async () => {
    setState({ status: 'loading', dataUrl: null, error: null });
    try {
      const revealed = await mutateAsync({ wifiIndex, purpose: 'QR' });
      reset();
      const dataUrl = await renderWifiQrDataUrl(buildWifiQrPayload(revealed));
      if (mounted.current) setState({ status: 'ready', dataUrl, error: null });
    } catch (error) {
      reset();
      if (mounted.current) setState({ status: 'error', dataUrl: null, error });
    }
  }, [mutateAsync, reset, wifiIndex]);

  useEffect(() => {
    mounted.current = true;
    // Guard against the StrictMode double effect: one reveal per screen visit (rate limit 30/h).
    if (!started.current) {
      started.current = true;
      void load();
    }
    return () => {
      mounted.current = false;
    };
  }, [load]);

  return { ...state, retry: load };
}
