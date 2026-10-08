import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cx } from '../class-names';
import { Icon } from '../icon/icon';
import './accordion.css';

export interface AccordionProps {
  title: ReactNode;
  children: ReactNode;
  /** Uncontrolled initial state. */
  defaultOpen?: boolean;
  /** Controlled state; pair with `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Heading level wrapping the trigger (default 2). */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/** Collapsible card section (e.g. "Thông tin hợp đồng"); trigger exposes `aria-expanded`. */
export function Accordion({
  title,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  headingLevel = 2,
  className,
}: AccordionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;
  const panelId = useId();
  const Heading = `h${headingLevel}` as const;

  function toggle() {
    const next = !isOpen;
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <section className={cx('ui-accordion', isOpen && 'is-open', className)}>
      <Heading className="ui-accordion__heading">
        <button
          type="button"
          className="ui-accordion__trigger"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={toggle}
        >
          <span className="ui-accordion__title">{title}</span>
          <Icon icon={ChevronDown} className="ui-accordion__chevron" />
        </button>
      </Heading>
      {/* `hidden` keeps the closed content out of the a11y tree; CSS animates the height in/out. */}
      <div className="ui-accordion__panel" id={panelId} hidden={!isOpen}>
        <div className="ui-accordion__inner">{children}</div>
      </div>
    </section>
  );
}
