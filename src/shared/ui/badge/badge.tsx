import type { HTMLAttributes } from 'react';
import { cx } from '../class-names';
import './badge.css';

export type BadgeTone = 'brand' | 'danger' | 'neutral' | 'success' | 'warning';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** `label` = small pill tag (e.g. ONT); `count` = round numeric bubble. */
  variant?: 'label' | 'count';
}

export function Badge({ tone = 'brand', variant = 'label', className, ...rest }: BadgeProps) {
  return (
    <span className={cx('ui-badge', `ui-badge--${variant}`, `ui-badge--${tone}`, className)} {...rest} />
  );
}
