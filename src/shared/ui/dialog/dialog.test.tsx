import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './dialog';

function Harness({
  onConfirm = () => {},
  confirmLoading,
  cancelLabel = 'Cancel',
}: {
  onConfirm?: () => void;
  confirmLoading?: boolean;
  cancelLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Delete room
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete location?"
        description="All measurements will be removed."
        confirmLabel="Delete"
        cancelLabel={cancelLabel}
        destructive
        confirmLoading={confirmLoading}
        onConfirm={onConfirm}
      />
    </>
  );
}

function openDialog() {
  const trigger = screen.getByRole('button', { name: 'Delete room' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe('Dialog', () => {
  it('renders an alertdialog with title, description and focus on the safe action', () => {
    render(<Harness />);
    openDialog();

    const dialog = screen.getByRole('alertdialog', { name: 'Delete location?' });
    expect(dialog).toHaveAccessibleDescription('All measurements will be removed.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('ui-dialog__action--destructive');
  });

  it('confirms through onConfirm and cancels through onClose', () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const trigger = openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on Esc and returns focus to the trigger', () => {
    render(<Harness />);
    const trigger = openDialog();

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('blocks dismissal and both actions while the confirm action is loading', () => {
    render(<Harness confirmLoading />);
    openDialog();

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
