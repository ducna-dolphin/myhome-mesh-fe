import { cx } from '../class-names';
import './signal-bars.css';

export type SignalLevel = 'GOOD' | 'FAIR' | 'WEAK';

const filledBars: Record<SignalLevel, number> = { GOOD: 3, FAIR: 2, WEAK: 1 };

export interface SignalBarsProps {
  /** `null` = not measured: three empty bars. */
  level: SignalLevel | null;
  /** Accessible name (e.g. the localized level). Omit when a visible label sits next to it. */
  label?: string;
  /** Fill the bars one by one on mount (fresh measurement result). Final state without motion. */
  animated?: boolean;
  className?: string;
}

/** Three ascending bars coloured by Wi-Fi signal level. */
export function SignalBars({ level, label, animated = false, className }: SignalBarsProps) {
  const filled = level ? filledBars[level] : 0;
  return (
    <span
      className={cx(
        'ui-signal-bars',
        level && `ui-signal-bars--${level.toLowerCase()}`,
        animated && 'ui-signal-bars--animated',
        className,
      )}
      data-level={level ?? 'NONE'}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {[1, 2, 3].map((bar) => (
        <span key={bar} className={cx('ui-signal-bars__bar', bar <= filled && 'is-filled')} />
      ))}
    </span>
  );
}
