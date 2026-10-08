import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../class-names';
import { Spinner } from '../spinner/spinner';
import './button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = filled teal, secondary = teal outline, ghost = text only, danger = filled red. */
  variant?: ButtonVariant;
  /** md = 48px (XD main CTA), sm = 32px visual with a 44px hit area. */
  size?: ButtonSize;
  /**
   * Shows a centred spinner over the (hidden) label, sets `aria-busy` and blocks clicks. The label
   * keeps its space, so the button width never changes.
   */
  loading?: boolean;
  fullWidth?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  startIcon,
  endIcon,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        fullWidth && 'ui-button--full',
        loading && 'is-loading',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span className="ui-button__spinner" aria-hidden="true">
          <Spinner size={size === 'sm' ? 14 : 18} />
        </span>
      )}
      {startIcon}
      <span className="ui-button__label">{children}</span>
      {endIcon}
    </button>
  );
}
