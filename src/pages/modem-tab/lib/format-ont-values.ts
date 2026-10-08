import { bytesToGb } from '@/entities/ont-device';
import { formatFixedDecimal } from '@/shared/lib';

const pad = (value: number) => String(value).padStart(2, '0');

export interface UptimeParts {
  days: number;
  hours: string;
  minutes: string;
}

/** `uptimeSec` → days + zero-padded hours/minutes for "N ngày HHgMMp" (XD "3 ngày 09g33p"). */
export function splitUptimeSec(totalSeconds: number): UptimeParts {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return {
    days: Math.floor(safe / 86_400),
    hours: pad(Math.floor((safe % 86_400) / 3_600)),
    minutes: pad(Math.floor((safe % 3_600) / 60)),
  };
}

/** Bytes → "485,62" (GB, 2 decimals, vi-VN). `null` when unknown (G-07). */
export function formatTrafficGb(bytes: number | null | undefined, locale = 'vi-VN'): string | null {
  const gb = bytesToGb(bytes);
  return gb === null ? null : formatFixedDecimal(gb, locale, 2);
}

/** Temperature with at most one decimal, e.g. "42" / "39,5". */
export function formatTemperature(celsius: number | null | undefined, locale = 'vi-VN'): string | null {
  if (celsius === null || celsius === undefined) return null;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(celsius);
}
