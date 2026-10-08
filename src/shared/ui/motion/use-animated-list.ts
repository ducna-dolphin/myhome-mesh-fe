import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { prefersReducedMotion, runExit } from './run-exit';

export type AnimatedEntryState = 'idle' | 'enter' | 'leave';

export interface AnimatedEntry<T> {
  key: string;
  item: T;
  /** `enter` = inserted after the first render, `leave` = removed and animating out. */
  state: AnimatedEntryState;
}

/** Attribute that marks list children for FLIP and exit tracking: `data-flip-key={entry.key}`. */
export const FLIP_KEY_ATTRIBUTE = 'data-flip-key';

function mergeEntries<T>(
  previous: AnimatedEntry<T>[],
  items: readonly T[],
  getKey: (item: T) => string,
): AnimatedEntry<T>[] {
  // From nothing (first data load) everything is simply there: the entrance is the list's stagger.
  if (previous.length === 0) return items.map((item) => ({ key: getKey(item), item, state: 'idle' }));
  const previousByKey = new Map(previous.map((entry) => [entry.key, entry]));
  const nextKeys = new Set<string>();
  const next: AnimatedEntry<T>[] = items.map((item) => {
    const key = getKey(item);
    nextKeys.add(key);
    const before = previousByKey.get(key);
    const state: AnimatedEntryState = !before || before.state === 'leave' ? 'enter' : before.state;
    return { key, item, state };
  });
  // Removed items stay at their previous position while they animate out.
  previous.forEach((entry, index) => {
    if (!nextKeys.has(entry.key)) next.splice(Math.min(index, next.length), 0, { ...entry, state: 'leave' });
  });
  return next;
}

interface Position {
  left: number;
  top: number;
}

function findByKey(container: HTMLElement | null, key: string): HTMLElement | null {
  if (!container) return null;
  for (const element of container.querySelectorAll<HTMLElement>(`[${FLIP_KEY_ATTRIBUTE}]`)) {
    if (element.getAttribute(FLIP_KEY_ATTRIBUTE) === key) return element;
  }
  return null;
}

function readPositions(container: HTMLElement): Map<string, Position> {
  const positions = new Map<string, Position>();
  container.querySelectorAll<HTMLElement>(`[${FLIP_KEY_ATTRIBUTE}]`).forEach((element) => {
    const key = element.getAttribute(FLIP_KEY_ATTRIBUTE);
    if (key) positions.set(key, { left: element.offsetLeft, top: element.offsetTop });
  });
  return positions;
}

/**
 * Keyed list with insert/remove animations: new items get `state: 'enter'`, removed items stay
 * rendered with `state: 'leave'` until their exit animation ends, and the remaining items slide to
 * their new slots (FLIP on `transform`, measured with offsets so scrolling does not matter).
 * Render each entry with `data-flip-key={entry.key}` inside `containerRef`.
 */
export function useAnimatedList<T>(
  items: readonly T[],
  getKey: (item: T) => string,
): { entries: AnimatedEntry<T>[]; containerRef: RefObject<HTMLElement | null> } {
  const containerRef = useRef<HTMLElement | null>(null);
  const [previousItems, setPreviousItems] = useState(items);
  const [entries, setEntries] = useState<AnimatedEntry<T>[]>(() =>
    items.map((item) => ({ key: getKey(item), item, state: 'idle' })),
  );
  if (items !== previousItems) {
    setPreviousItems(items);
    setEntries(mergeEntries(entries, items, getKey));
  }

  const positions = useRef<Map<string, Position>>(new Map());
  const keySignature = entries.map((entry) => `${entry.key}:${entry.state === 'leave' ? 0 : 1}`).join('|');
  const leavingSignature = entries
    .filter((entry) => entry.state === 'leave')
    .map((entry) => entry.key)
    .join('|');

  // FLIP: slide the items that moved because something was inserted or removed.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const next = readPositions(container);
    const previous = positions.current;
    positions.current = next;
    if (previous.size === 0 || prefersReducedMotion()) return;
    next.forEach((position, key) => {
      const before = previous.get(key);
      if (!before) return;
      const dx = before.left - position.left;
      const dy = before.top - position.top;
      if (dx === 0 && dy === 0) return;
      const element = findByKey(container, key);
      if (!element) return;
      element.style.transition = 'none';
      element.style.transform = `translate(${dx}px, ${dy}px)`;
      void element.offsetWidth;
      element.style.transition = 'transform var(--duration-base) var(--ease-out-quart)';
      element.style.transform = '';
      const clear = () => {
        element.style.transition = '';
        element.removeEventListener('transitionend', clear);
      };
      element.addEventListener('transitionend', clear);
    });
  }, [keySignature]);

  // Drop removed items once their exit animation has finished.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!leavingSignature) return;
    const cleanups = leavingSignature.split('|').map((key) => {
      const element = findByKey(container, key);
      return runExit(element, () =>
        setEntries((current) => current.filter((entry) => !(entry.key === key && entry.state === 'leave'))),
      );
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [leavingSignature]);

  return { entries, containerRef };
}
