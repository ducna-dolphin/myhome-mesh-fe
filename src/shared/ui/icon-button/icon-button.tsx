import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../class-names';
import { Icon, type LucideIcon } from '../icon/icon';
import './icon-button.css';

export type IconButtonVariant = 'outline' | 'ghost' | 'soft';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  icon: LucideIcon;
  /** Required accessible name: the button has no visible text. */
  label: string;
  /** outline = XD close button (white circle, hairline border); ghost = no chrome; soft = teal tint. */
  variant?: IconButtonVariant;
}

/** 36px round icon button with a 44px touch target. */
export function IconButton({
  icon,
  label,
  variant = 'outline',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx('ui-icon-button', `ui-icon-button--${variant}`, className)}
      {...rest}
    >
      <Icon icon={icon} />
    </button>
  );
}
