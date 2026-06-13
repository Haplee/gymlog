import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min — no refetch si los datos son recientes
      gcTime: 1000 * 60 * 60 * 24, // 24h — debe cubrir el maxAge del persister offline
      refetchOnWindowFocus: false, // evita refetch al volver a la pestaña
      refetchOnMount: false, // no refetch si ya hay datos en caché
      retry: 1,
      // networkMode 'online' (default): pausa queries/mutaciones sin red y
      // las reanuda al reconectar.
    },
    mutations: {
      retry: 0,
    },
  },
});
