import type { UIMatch } from 'react-router-dom';
import { isRouteTitleKey, type RouteTitleKey } from '@/shared/i18n';

/** `handle` of a sub-page route: header title and the tab to return to after a deep link. */
export interface SubPageHandle {
  titleKey: RouteTitleKey;
  backTo: string;
}

export function findSubPageHandle(matches: UIMatch[]): SubPageHandle | undefined {
  for (const match of [...matches].reverse()) {
    const handle = match.handle as Partial<SubPageHandle> | undefined;
    if (handle && isRouteTitleKey(handle.titleKey) && typeof handle.backTo === 'string') {
      return { titleKey: handle.titleKey, backTo: handle.backTo };
    }
  }
  return undefined;
}
