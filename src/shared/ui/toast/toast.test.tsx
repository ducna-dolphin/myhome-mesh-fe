import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from './toast-context';
import { ToastProvider } from './toast-provider';

function Trigger({ message }: { message: string }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show(message)}>
      {`Show ${message}`}
    </button>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces the message in a status region and hides it after 3s', () => {
    render(
      <ToastProvider>
        <Trigger message="Saved" />
      </ToastProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole('button', { name: 'Show Saved' }));
    expect(region).toHaveTextContent('Saved');

    act(() => vi.advanceTimersByTime(2999));
    expect(region).toHaveTextContent('Saved');

    act(() => vi.advanceTimersByTime(1));
    expect(region).toBeEmptyDOMElement();
  });

  it('replaces the visible toast and restarts the timer', () => {
    render(
      <ToastProvider>
        <Trigger message="First" />
        <Trigger message="Second" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show First' }));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole('button', { name: 'Show Second' }));

    expect(screen.getByRole('status')).toHaveTextContent('Second');
    expect(screen.getByRole('status')).not.toHaveTextContent('First');

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('status')).toHaveTextContent('Second');

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('throws a helpful error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger message="x" />)).toThrow(/ToastProvider/);
  });
});
