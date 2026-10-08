import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './switch';

function Controlled({ pending = false }: { pending?: boolean }) {
  const [checked, setChecked] = useState(false);
  return <Switch label="Wi-Fi" checked={checked} onCheckedChange={setChecked} pending={pending} />;
}

describe('Switch', () => {
  it('exposes switch semantics and toggles aria-checked', () => {
    render(<Controlled />);
    const toggle = screen.getByRole('switch', { name: 'Wi-Fi' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('stays focusable but ignores input while pending', () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Block" checked onCheckedChange={onCheckedChange} pending />);
    const toggle = screen.getByRole('switch', { name: 'Block' });

    expect(toggle).toHaveAttribute('aria-busy', 'true');
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('does not toggle when disabled', () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Block" checked={false} onCheckedChange={onCheckedChange} disabled />);
    const toggle = screen.getByRole('switch', { name: 'Block' });

    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
