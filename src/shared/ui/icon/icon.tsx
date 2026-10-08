import type { LucideIcon, LucideProps } from 'lucide-react';
import { cx } from '../class-names';
import './icon.css';

export type { LucideIcon } from 'lucide-react';

export interface IconProps extends Omit<LucideProps, 'ref' | 'aria-label'> {
  icon: LucideIcon;
  /** Accessible name. Omit for decorative icons (the default), which are hidden from assistive tech. */
  label?: string;
}

/** Lucide icon with the XD defaults: 20px, 1.5px stroke, decorative unless `label` is given. */
export function Icon({ icon: Glyph, size = 20, strokeWidth = 1.5, label, className, ...rest }: IconProps) {
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={cx('ui-icon', className)}
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      {...rest}
    />
  );
}
