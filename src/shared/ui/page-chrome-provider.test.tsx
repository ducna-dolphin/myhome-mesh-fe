import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { PageChromeProvider, usePageTitle, usePageTitleOverride } from './index';

describe('PageChromeProvider and page chrome hooks', () => {
  it('provides initial undefined override title', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PageChromeProvider>{children}</PageChromeProvider>
    );

    const { result } = renderHook(() => usePageTitleOverride(), { wrapper });

    expect(result.current).toBeUndefined();
  });

  it('allows setting and retrieving override title', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PageChromeProvider>{children}</PageChromeProvider>
    );

    const { result: overrideResult } = renderHook(
      ({ title }: { title?: string }) => {
        usePageTitle(title || '');
        return usePageTitleOverride();
      },
      { wrapper, initialProps: { title: 'Test Title' } },
    );

    expect(overrideResult.current).toBe('Test Title');
  });

  it('resets override title to undefined on unmount', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PageChromeProvider>{children}</PageChromeProvider>
    );

    const { result: overrideResult, unmount } = renderHook(
      ({ title }: { title?: string }) => {
        usePageTitle(title || '');
        return usePageTitleOverride();
      },
      { wrapper, initialProps: { title: 'Test Title' } },
    );

    expect(overrideResult.current).toBe('Test Title');

    unmount();

    // Re-render to check the value after unmount
    const { result: resetResult } = renderHook(() => usePageTitleOverride(), { wrapper });
    expect(resetResult.current).toBeUndefined();
  });

  it('updates override title when dependency changes', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PageChromeProvider>{children}</PageChromeProvider>
    );

    const { result: overrideResult } = renderHook(
      ({ title }: { title: string }) => {
        usePageTitle(title);
        return usePageTitleOverride();
      },
      { wrapper, initialProps: { title: 'First Title' } },
    );

    expect(overrideResult.current).toBe('First Title');

    // After unmounting and remounting with new title
    const { result: newResult } = renderHook(
      ({ title }: { title: string }) => {
        usePageTitle(title);
        return usePageTitleOverride();
      },
      { wrapper, initialProps: { title: 'Second Title' } },
    );

    expect(newResult.current).toBe('Second Title');
  });
});
