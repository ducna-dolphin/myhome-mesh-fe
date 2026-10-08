const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

function toLocalDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `dd/MM/yyyy`. A date-only value (`YYYY-MM-DD`, e.g. contract dates) is a calendar date and is
 * printed as written; a datetime (UTC from the backend) is converted to the device time zone.
 * Returns `null` for empty or unparsable input so callers can render "—".
 */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dateOnly = DATE_ONLY.exec(iso);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = toLocalDate(iso);
  if (!date) return null;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** `HH:mm` in the device time zone (e.g. the "Cập nhật lúc HH:mm" stale label). */
export function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = toLocalDate(iso);
  if (!date) return null;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `HH:mm - dd/MM/yyyy` in the device time zone (LLD display format; backend sends UTC). */
export function formatDateTime(iso: string | null | undefined): string | null {
  const time = formatTime(iso);
  const date = time && toLocalDate(iso!);
  if (!time || !date) return null;
  return `${time} - ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
