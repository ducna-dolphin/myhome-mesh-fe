import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Badge, type BadgeTone } from '../badge/badge';
import { cx } from '../class-names';
import './chip.css';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Selected look (teal outline). Pass `aria-pressed` yourself only for toggle semantics; see FilterChip. */
  selected?: boolean;
  startIcon?: ReactNode;
}

/** Pill-shaped tappable chip, e.g. a name suggestion ("Phòng khách"). */
export function Chip({
  selected = false,
  startIcon,
  className,
  children,
  type = 'button',
  ...rest
}: ChipProps) {
  return (
    <button type={type} className={cx('ui-chip', selected && 'is-selected', className)} {...rest}>
      {startIcon}
      {children}
    </button>
  );
}

export interface FilterChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-pressed' | 'children'
> {
  label: string;
  pressed: boolean;
  /** Optional count shown in a badge, e.g. "Đang bị chặn 1". */
  count?: number;
  countTone?: BadgeTone;
}

/** Toggle chip for list filters; exposes its state with `aria-pressed`. */
export function FilterChip({ label, pressed, count, countTone = 'danger', ...rest }: FilterChipProps) {
  return (
    <Chip selected={pressed} aria-pressed={pressed} {...rest}>
      <span>{label}</span>
      {count !== undefined && (
        <Badge variant="count" tone={countTone}>
          {count}
        </Badge>
      )}
    </Chip>
  );
}
