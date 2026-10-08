import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatTime } from './format-date-time';

const pad = (value: number) => String(value).padStart(2, '0');

describe('date/time formatters', () => {
  it('prints a date-only value as the calendar date', () => {
    expect(formatDate('2026-12-31')).toBe('31/12/2026');
  });

  it('converts UTC datetimes to local time', () => {
    const iso = '2026-10-08T01:05:00Z';
    const local = new Date(iso);
    const time = `${pad(local.getHours())}:${pad(local.getMinutes())}`;
    const date = `${pad(local.getDate())}/${pad(local.getMonth() + 1)}/${local.getFullYear()}`;
    expect(formatTime(iso)).toBe(time);
    expect(formatDate(iso)).toBe(date);
    expect(formatDateTime(iso)).toBe(`${time} - ${date}`);
  });

  it('returns null for empty or invalid input', () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate('not-a-date')).toBeNull();
    expect(formatTime(undefined)).toBeNull();
    expect(formatDateTime('')).toBeNull();
  });
});
