import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/** Search param that names the open sheet: `?sheet=<name>`. */
export const SHEET_PARAM = 'sheet';

interface SheetHistoryState {
  /** Set on the history entry pushed by `open()`, so `close()` knows it can go back. */
  sheetOpenedInApp?: string;
}

export interface UseSheetParamOptions {
  /** Extra search params owned by this sheet; removed when it is closed after a deep link. */
  paramKeys?: readonly string[];
}

export interface SheetParam {
  isOpen: boolean;
  /** Value of an extra param of the open sheet (e.g. `ssid`), `null` when absent. */
  getParam: (key: string) => string | null;
  /** Pushes `?sheet=<name>&…params`, so the Android back button closes the sheet. */
  open: (params?: Record<string, string>) => void;
  /** Goes back when the sheet was opened in-app; otherwise (deep link) replaces the URL. */
  close: () => void;
}

/**
 * Sheet visibility stored in the URL. Opening pushes a history entry; closing pops it
 * (`navigate(-1)`) so hardware/gesture back and the close button behave the same.
 */
export function useSheetParam(name: string, { paramKeys = [] }: UseSheetParamOptions = {}): SheetParam {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isOpen = searchParams.get(SHEET_PARAM) === name;
  const paramKeysKey = paramKeys.join('\u0000');

  const open = useCallback(
    (params: Record<string, string> = {}) => {
      const next = new URLSearchParams(location.search);
      next.set(SHEET_PARAM, name);
      for (const [key, value] of Object.entries(params)) next.set(key, value);
      const state: SheetHistoryState = { sheetOpenedInApp: name };
      navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { state });
    },
    [location.pathname, location.search, name, navigate],
  );

  const close = useCallback(() => {
    const state = location.state as SheetHistoryState | null;
    if (new URLSearchParams(location.search).get(SHEET_PARAM) !== name) return;
    if (state?.sheetOpenedInApp === name) {
      navigate(-1);
      return;
    }
    const next = new URLSearchParams(location.search);
    next.delete(SHEET_PARAM);
    for (const key of paramKeysKey ? paramKeysKey.split('\u0000') : []) next.delete(key);
    const search = next.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, location.state, name, navigate, paramKeysKey]);

  const getParam = useCallback(
    (key: string) => (isOpen ? searchParams.get(key) : null),
    [isOpen, searchParams],
  );

  return useMemo(() => ({ isOpen, getParam, open, close }), [isOpen, getParam, open, close]);
}
