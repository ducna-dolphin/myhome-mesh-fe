/**
 * Formats the calendar date of an ISO string (YYYY-MM-DD or a datetime) as dd/MM/yyyy-style
 * for the locale. Uses the date part as written, so the server's offset date is preserved.
 */
export function formatDateOnly(isoDate: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

/** Formats a number with a fixed number of fraction digits, e.g. 485,62 in vi-VN. */
export function formatFixedDecimal(value: number, locale: string, fractionDigits = 2) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
