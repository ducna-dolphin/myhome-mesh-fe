import { cx } from '../class-names';
import './spinner.css';

/** Decorative busy indicator; pair it with `aria-busy` or visible text on the owning control. */
export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span className={cx('ui-spinner', className)} style={{ width: size, height: size }} aria-hidden="true" />
  );
}
