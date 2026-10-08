import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../class-names';
import '../spinner/spinner.css';
import './switch.css';

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'role' | 'aria-checked' | 'children'
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name when there is no visible `<label>`/`aria-labelledby`. */
  label?: string;
  /**
   * The new value is being saved. The switch stays focusable but ignores input and reports
   * `aria-busy`, so keyboard users do not lose their place while the request runs.
   */
  pending?: boolean;
}

/** iOS-style toggle (51×31) with `role="switch"`. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  pending = false,
  disabled,
  className,
  onClick,
  ...rest
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      disabled={disabled}
      className={cx('ui-switch', checked && 'is-checked', pending && 'is-pending', className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || pending) return;
        onCheckedChange(!checked);
      }}
      {...rest}
    >
      <span className="ui-switch__thumb" aria-hidden="true" />
    </button>
  );
}
