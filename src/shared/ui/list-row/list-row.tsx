import { ChevronRight } from 'lucide-react';
import type { AriaAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '../class-names';
import { Icon } from '../icon/icon';
import './list-row.css';

export type ListRowTone = 'default' | 'danger';
export type ListRowIconTone = 'brand' | 'danger' | 'neutral';

interface ListRowBaseProps {
  /** Icon rendered inside the round tinted badge (usually `<Icon icon={…} />`). */
  icon?: ReactNode;
  iconTone?: ListRowIconTone;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional third line, e.g. a status dot + text. */
  meta?: ReactNode;
  /** Right-hand slot (switch, value, badge…). Stays independently clickable above the row action. */
  trailing?: ReactNode;
  /** Shows a chevron; defaults to true for link/button rows. */
  chevron?: boolean;
  /** `danger` colours the title red (blocked device, destructive action row). */
  tone?: ListRowTone;
  /** `card` = standalone white card (XD device list); `plain` = divider-separated row inside a card. */
  variant?: 'plain' | 'card';
  className?: string;
}

/** `data-*` / `aria-*` attributes forwarded to the row root (e.g. `data-focused` for highlights). */
type ListRowPassThroughProps = AriaAttributes & {
  [key: `data-${string}`]: string | number | boolean | undefined;
};

type ListRowActionProps =
  | { to: string; onClick?: never; disabled?: never }
  | { to?: never; onClick: () => void; disabled?: boolean }
  | { to?: never; onClick?: never; disabled?: never };

export type ListRowProps = ListRowBaseProps & ListRowActionProps & ListRowPassThroughProps;

/**
 * Row with a round tinted icon, title/subtitle and trailing slot. When `to` or `onClick` is given,
 * the title block becomes the link/button and stretches its hit area over the whole row, so the
 * trailing slot can still hold its own control without nesting interactive elements.
 */
export function ListRow({
  icon,
  iconTone = 'brand',
  title,
  subtitle,
  meta,
  trailing,
  chevron,
  tone = 'default',
  variant = 'plain',
  className,
  to,
  onClick,
  disabled,
  ...passThrough
}: ListRowProps) {
  const interactive = to !== undefined || onClick !== undefined;
  const showChevron = chevron ?? interactive;
  const body = (
    <>
      {/* Full text stays available when the title is truncated with an ellipsis. */}
      <span className="ui-list-row__title" title={typeof title === 'string' ? title : undefined}>
        {title}
      </span>
      {subtitle && <span className="ui-list-row__subtitle">{subtitle}</span>}
      {meta && <span className="ui-list-row__meta">{meta}</span>}
    </>
  );

  let content: ReactNode;
  if (to !== undefined) {
    content = (
      // Sub-page push: react-router wraps it in a View Transition (slide), no-op where unsupported.
      <Link className="ui-list-row__body ui-list-row__action" to={to} viewTransition>
        {body}
      </Link>
    );
  } else if (onClick !== undefined) {
    content = (
      <button
        type="button"
        className="ui-list-row__body ui-list-row__action"
        onClick={onClick}
        disabled={disabled}
      >
        {body}
      </button>
    );
  } else {
    content = <div className="ui-list-row__body">{body}</div>;
  }

  return (
    <div
      {...passThrough}
      className={cx(
        'ui-list-row',
        `ui-list-row--${variant}`,
        tone === 'danger' && 'ui-list-row--danger',
        interactive && 'is-interactive',
        disabled && 'is-disabled',
        className,
      )}
    >
      {icon && (
        <span className={cx('ui-list-row__icon', `ui-list-row__icon--${iconTone}`)} aria-hidden="true">
          {icon}
        </span>
      )}
      {content}
      {trailing !== undefined && <div className="ui-list-row__trailing">{trailing}</div>}
      {showChevron && <Icon icon={ChevronRight} className="ui-list-row__chevron" />}
    </div>
  );
}
