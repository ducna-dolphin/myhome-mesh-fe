import { useMemo, useState, type PropsWithChildren } from 'react';
import { PageChromeContext } from './page-chrome-context';

export function PageChromeProvider({ children }: PropsWithChildren) {
  const [overrideTitle, setOverrideTitle] = useState<string>();
  const value = useMemo(() => ({ overrideTitle, setOverrideTitle }), [overrideTitle]);

  return <PageChromeContext.Provider value={value}>{children}</PageChromeContext.Provider>;
}
