import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { matchPath, NavLink, resolvePath, useLocation, useResolvedPath } from 'react-router-dom';
import { cx } from '../class-names';
import './segmented-tabs.css';

export interface SegmentedTabItem {
  to: string;
  label: string;
  /** Match the route exactly (NavLink `end`). */
  end?: boolean;
}

export interface SegmentedTabsProps {
  items: SegmentedTabItem[];
  /** Accessible name of the tablist. */
  label: string;
  className?: string;
}

function SegmentedTab({
  item,
  selected,
  isFocusTarget,
}: {
  item: SegmentedTabItem;
  selected: boolean;
  isFocusTarget: boolean;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      role="tab"
      aria-selected={selected}
      tabIndex={isFocusTarget ? 0 : -1}
      className={cx('ui-segmented-tabs__tab', selected && 'is-selected')}
    >
      {item.label}
    </NavLink>
  );
}

interface IndicatorBox {
  x: number;
  width: number;
}

/**
 * Measures the selected tab so one pill can slide between tabs (`transform` + `width`), instead of
 * each tab painting its own background. Re-measures on resize (font load, rotation).
 */
function useIndicator(listRef: RefObject<HTMLDivElement | null>, selectedIndex: number) {
  const [box, setBox] = useState<IndicatorBox | null>(null);
  const [animated, setAnimated] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const tab = list.querySelectorAll<HTMLElement>('[role="tab"]')[selectedIndex];
      if (!tab || tab.offsetWidth === 0) {
        setBox(null);
        return;
      }
      setBox((current) =>
        current?.x === tab.offsetLeft && current.width === tab.offsetWidth
          ? current
          : { x: tab.offsetLeft, width: tab.offsetWidth },
      );
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, selectedIndex]);

  // First placement is instant; later changes slide.
  useLayoutEffect(() => {
    if (box && !animated) {
      const frame = requestAnimationFrame(() => setAnimated(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [box, animated]);

  const style = box
    ? ({ '--indicator-x': `${box.x}px`, '--indicator-width': `${box.width}px` } as CSSProperties)
    : undefined;
  return { placed: box !== null, animated: box !== null && animated, style };
}

/**
 * Pill segmented control whose segments are routes. Follows the ARIA tabs pattern with roving
 * tabindex and automatic activation: ←/→ (and Home/End) move focus and navigate.
 */
export function SegmentedTabs({ items, label, className }: SegmentedTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const base = useResolvedPath('.').pathname;
  // Same matching as NavLink, computed once so the selected tab also owns the roving tabindex.
  const selectedIndex = items.findIndex(
    (item) =>
      matchPath({ path: resolvePath(item.to, base).pathname, end: item.end ?? false }, pathname) !== null,
  );
  const focusIndex = selectedIndex === -1 ? 0 : selectedIndex;
  const indicator = useIndicator(listRef, selectedIndex);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>('[role="tab"]') ?? []);
    const current = tabs.indexOf(document.activeElement as HTMLAnchorElement);
    if (current === -1) return;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (current + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        next = (current - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = tabs[next];
    target?.focus();
    target?.click();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={cx(
        'ui-segmented-tabs',
        indicator.placed && 'has-indicator',
        indicator.animated && 'is-animated',
        className,
      )}
      style={indicator.style}
      onKeyDown={handleKeyDown}
    >
      <span className="ui-segmented-tabs__indicator" aria-hidden="true" />
      {items.map((item, index) => (
        <SegmentedTab
          key={item.to}
          item={item}
          selected={index === selectedIndex}
          isFocusTarget={index === focusIndex}
        />
      ))}
    </div>
  );
}
