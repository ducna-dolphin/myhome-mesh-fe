import { cx } from '../class-names';
import './skeleton.css';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  shape?: 'rect' | 'text' | 'circle' | 'pill';
  className?: string;
}

/** Decorative loading placeholder; announce loading elsewhere (e.g. `aria-busy` on the region). */
export function Skeleton({ width = '100%', height = 16, shape = 'rect', className }: SkeletonProps) {
  return (
    <span
      className={cx('ui-skeleton', `ui-skeleton--${shape}`, className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
