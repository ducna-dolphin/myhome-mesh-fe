import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './bottom-sheet';

function Harness({ onClose = () => {}, dismissible }: { onClose?: () => void; dismissible?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <BottomSheet
        open={open}
        title="Wi-Fi options"
        closeLabel="Close"
        dismissible={dismissible}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        footer={<button type="button">Save</button>}
      >
        <p>Sheet body</p>
      </BottomSheet>
    </>
  );
}

function openSheet() {
  const trigger = screen.getByRole('button', { name: 'Open sheet' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe('BottomSheet (fallback without showModal)', () => {
  it('opens as a labelled modal, moves focus inside and locks body scroll', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    openSheet();

    const sheet = screen.getByRole('dialog', { name: 'Wi-Fi options' });
    expect(sheet).toHaveAttribute('open');
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Sheet body')).toBeVisible();
    expect(sheet).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Esc and returns focus to the trigger', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = openSheet();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on scrim click and on the close button, but not on a click inside the panel', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openSheet();

    fireEvent.click(screen.getByText('Sheet body'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);

    openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('traps Tab inside the sheet', () => {
    render(<Harness />);
    openSheet();
    const close = screen.getByRole('button', { name: 'Close' });
    const save = screen.getByRole('button', { name: 'Save' });

    save.focus();
    fireEvent.keyDown(save, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();
  });

  it('ignores Esc and scrim when not dismissible', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} dismissible={false} />);
    openSheet();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('BottomSheet (native showModal)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Remove the stubs so other tests exercise the fallback again.
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  it('uses showModal()/close() and treats the native cancel event as a close request', () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value: showModal, configurable: true });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { value: close, configurable: true });

    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = openSheet();

    const sheet = screen.getByRole('dialog', { name: 'Wi-Fi options' });
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(sheet).not.toHaveAttribute('aria-modal');

    const cancel = new Event('cancel', { cancelable: true });
    act(() => {
      sheet.dispatchEvent(cancel);
    });

    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });
});

describe('BottomSheet exit animation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function stubExitAnimation() {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = real(element);
      const closing = element.closest?.('[data-state="closing"]') !== null;
      return Object.assign(Object.create(style) as CSSStyleDeclaration, {
        animationName: closing ? 'ui-sheet-out' : 'none',
        animationDuration: closing ? '260ms' : '0s',
        animationDelay: '0s',
        transitionDuration: '0s',
        transitionDelay: '0s',
      });
    });
  }

  it('keeps the sheet mounted while it slides out and calls onClose when the exit ends', () => {
    vi.useFakeTimers();
    stubExitAnimation();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    openSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    const sheet = screen.getByRole('dialog');
    expect(sheet).toHaveAttribute('data-state', 'closing');
    expect(screen.getByText('Sheet body')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // A second close request during the exit is ignored.
    fireEvent.keyDown(sheet, { key: 'Escape' });
    act(() => vi.advanceTimersByTime(400));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('animates the last content out when the owner closes it from outside', () => {
    stubExitAnimation();
    function External() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            Back
          </button>
          <BottomSheet open={open} title="Options" closeLabel="Close" onClose={() => setOpen(false)}>
            {open ? <p>Live content</p> : null}
          </BottomSheet>
        </>
      );
    }
    render(<External />);

    fireEvent.click(screen.getByRole('button', { name: 'Back', hidden: true }));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closing');
    expect(screen.getByText('Live content')).toBeInTheDocument();

    const panel = screen.getByText('Live content').closest('.ui-sheet__panel')!;
    act(() => {
      panel.dispatchEvent(new Event('animationend'));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
