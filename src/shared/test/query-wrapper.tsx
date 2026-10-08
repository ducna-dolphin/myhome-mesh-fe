import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { createTestQueryClient } from './render-with-providers';

/** `renderHook` wrapper with an isolated QueryClient. */
export function createQueryWrapper(queryClient: QueryClient = createTestQueryClient()) {
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper: Wrapper };
}
