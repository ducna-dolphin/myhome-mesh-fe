import { describe, expect, it } from 'vitest';
import { navDirection } from './nav-direction';
import { keyboardInset } from './use-keyboard-inset';

describe('navDirection', () => {
  it.each([
    [null, '/wifi', 'none'],
    ['/wifi', '/wifi', 'none'],
    ['/wifi', '/devices', 'none'],
    ['/wifi', '/wifi/0/edit', 'forward'],
    ['/devices/AA', '/devices/AA/edit', 'forward'],
    ['/devices/AA/edit', '/devices/AA', 'back'],
    ['/wifi/0/share', '/wifi', 'back'],
  ] as const)('%s → %s = %s', (from, to, expected) => {
    expect(navDirection(from, to)).toBe(expected);
  });
});

describe('keyboardInset', () => {
  it('is the layout height hidden below the visual viewport, never negative', () => {
    expect(keyboardInset(844, 844, 0)).toBe(0);
    expect(keyboardInset(844, 508, 0)).toBe(336);
    expect(keyboardInset(844, 508, 120)).toBe(216);
    expect(keyboardInset(844, 900, 0)).toBe(0);
  });
});
