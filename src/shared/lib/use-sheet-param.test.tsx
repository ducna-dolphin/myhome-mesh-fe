import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useSheetParam } from './use-sheet-param';

function setup(initialEntries: string[]) {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
        {children}
      </MemoryRouter>
    );
  }
  return renderHook(
    () => ({ sheet: useSheetParam('options', { paramKeys: ['ssid'] }), location: useLocation() }),
    { wrapper: Wrapper },
  );
}

describe('useSheetParam', () => {
  it('opens with a pushed entry and closes by going back', () => {
    const { result } = setup(['/wifi?tab=1']);
    expect(result.current.sheet.isOpen).toBe(false);

    act(() => result.current.sheet.open({ ssid: 'Home' }));
    expect(result.current.sheet.isOpen).toBe(true);
    expect(result.current.sheet.getParam('ssid')).toBe('Home');
    expect(result.current.location.search).toBe('?tab=1&sheet=options&ssid=Home');

    act(() => result.current.sheet.close());
    expect(result.current.sheet.isOpen).toBe(false);
    expect(result.current.location.search).toBe('?tab=1');
  });

  it('replaces the URL when the sheet came from a deep link', () => {
    const { result } = setup(['/wifi', '/wifi?sheet=options&ssid=Home&keep=1']);
    expect(result.current.sheet.isOpen).toBe(true);
    const keyBefore = result.current.location.key;

    act(() => result.current.sheet.close());
    expect(result.current.sheet.isOpen).toBe(false);
    expect(result.current.location.pathname).toBe('/wifi');
    expect(result.current.location.search).toBe('?keep=1');
    expect(result.current.location.key).not.toBe(keyBefore);
  });

  it('ignores close when another sheet is open', () => {
    const { result } = setup(['/wifi?sheet=other']);
    act(() => result.current.sheet.close());
    expect(result.current.location.search).toBe('?sheet=other');
    expect(result.current.sheet.getParam('ssid')).toBeNull();
  });
});
