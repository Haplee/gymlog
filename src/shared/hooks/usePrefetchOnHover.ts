import { useCallback } from 'react';
import { queryClient } from '@app/queryClient';

export function usePrefetchOnHover(queryKey: unknown[], queryFn: () => Promise<unknown>) {
  const handlePrefetch = useCallback(() => {
    const isCached = queryClient.getQueryData(queryKey);
    if (!isCached) {
      queryClient.prefetchQuery({
        queryKey,
        queryFn,
      });
    }
  }, [queryKey, queryFn]);

  return { prefetch: handlePrefetch };
}
