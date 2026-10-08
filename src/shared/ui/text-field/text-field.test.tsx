import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from './text-field';

describe('TextField', () => {
  it('labels the input and counts characters against maxLength (uncontrolled)', () => {
    render(<TextField label="Location name" maxLength={30} defaultValue="Bếp" />);
    const input = screen.getByLabelText('Location name');

    expect(input).toHaveAttribute('maxlength', '30');
    expect(screen.getByText('3/30')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Phòng khách' } });
    expect(screen.getByText('11/30')).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription('11/30');
  });

  it('counts the controlled value', () => {
    function Controlled() {
      const [value, setValue] = useState('');
      return (
        <TextField label="SSID" maxLength={32} value={value} onChange={(e) => setValue(e.target.value)} />
      );
    }
    render(<Controlled />);

    fireEvent.change(screen.getByLabelText('SSID'), { target: { value: 'MyHome' } });
    expect(screen.getByText('6/32')).toBeInTheDocument();
  });

  it('reveals and hides the password with an accessible toggle', () => {
    render(
      <TextField
        label="Password"
        type="password"
        defaultValue="secret123"
        passwordToggleLabels={{ show: 'Show password', hide: 'Hide password' }}
      />,
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('marks errors as invalid and describes the input with the message instead of the helper', () => {
    render(<TextField label="RSSI" helper="Enter the value" error="Required" prefix="−" suffix="dBm" />);
    const input = screen.getByLabelText('RSSI');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Required');
    expect(screen.queryByText('Enter the value')).not.toBeInTheDocument();
    expect(screen.getByText('dBm')).toBeInTheDocument();
  });

  describe('clear button', () => {
    function Controlled({ onChange = () => {} }: { onChange?: (value: string) => void }) {
      const [value, setValue] = useState('Phòng khách');
      return (
        <TextField
          label="Tên vị trí"
          maxLength={30}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onChange(event.target.value);
          }}
        />
      );
    }

    it('clears a controlled value through onChange and keeps focus in the input', () => {
      const onChange = vi.fn();
      render(<Controlled onChange={onChange} />);
      const input = screen.getByLabelText('Tên vị trí');
      input.focus();

      const clear = screen.getByRole('button', { name: 'Xoá nội dung Tên vị trí' });
      fireEvent.click(clear);

      expect(onChange).toHaveBeenLastCalledWith('');
      expect(input).toHaveValue('');
      expect(input).toHaveFocus();
      expect(screen.queryByRole('button', { name: /Xoá nội dung/ })).not.toBeInTheDocument();
      expect(screen.getByText('0/30')).toBeInTheDocument();
    });

    it('is hidden when empty, on password fields, with a suffix, when disabled or opted out', () => {
      render(
        <>
          <TextField label="Empty" defaultValue="" />
          <TextField label="Password" type="password" defaultValue="secret123" />
          <TextField label="RSSI" suffix="dBm" defaultValue="65" />
          <TextField label="Disabled" defaultValue="x" disabled />
          <TextField label="Opted out" defaultValue="x" clearable={false} />
          <TextField label="Uncontrolled" defaultValue="x" />
        </>,
      );
      expect(screen.getAllByRole('button', { name: /Xoá nội dung/ })).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Xoá nội dung Uncontrolled' }));
      expect(screen.getByLabelText('Uncontrolled')).toHaveValue('');
    });
  });

  it('trims on blur when asked', () => {
    function Name() {
      const [value, setValue] = useState('');
      return (
        <TextField label="Name" trimOnBlur value={value} onChange={(event) => setValue(event.target.value)} />
      );
    }
    render(<Name />);
    const input = screen.getByLabelText('Name');
    fireEvent.change(input, { target: { value: '  Bếp  ' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('Bếp');
  });

  it('turns the counter to a warning near the limit', () => {
    render(<TextField label="Name" maxLength={30} defaultValue={'x'.repeat(26)} />);
    expect(screen.getByText('26/30')).not.toHaveClass('is-near-limit');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x'.repeat(27) } });
    expect(screen.getByText('27/30')).toHaveClass('is-near-limit');
  });
});
